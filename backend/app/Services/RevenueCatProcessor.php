<?php

namespace App\Services;

use App\Events\BillingUpdated;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Applique un événement RevenueCat. Idempotent : `webhook_events.id` (clé primaire) empêche tout double traitement,
 * `purchases.transaction_id` et `subscriptions.original_transaction_id` empêchent tout double crédit.
 *
 * Types d'événements traités (noms à confirmer dans la documentation officielle de RevenueCat avant la mise en production) :
 * INITIAL_PURCHASE, RENEWAL, UNCANCELLATION, PRODUCT_CHANGE, CANCELLATION, EXPIRATION, BILLING_ISSUE, NON_RENEWING_PURCHASE.
 */
class RevenueCatProcessor
{
    /** @param array<string, mixed> $payload @return string processed|duplicate|ignored */
    public function handle(array $payload): string
    {
        $event = $payload['event'] ?? null;
        if (! is_array($event) || empty($event['id']) || empty($event['type'])) {
            return 'ignored';
        }

        $inserted = DB::table('webhook_events')->insertOrIgnore([
            'id' => (string) $event['id'], 'payload' => json_encode($payload), 'created_at' => now(),
        ]);
        if ($inserted === 0) {
            return 'duplicate';
        }

        $userId = $this->resolveUser($event);
        if ($userId === null) {
            $this->done($event['id'], 'utilisateur inconnu');

            return 'ignored';
        }

        DB::transaction(function () use ($event, $userId) {
            match ($event['type']) {
                'INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE' => $this->activate($userId, $event),
                'BILLING_ISSUE' => $this->setStatus($event, 'grace'),
                'EXPIRATION' => $this->setStatus($event, 'expired'),
                'CANCELLATION' => $this->cancel($userId, $event),
                'NON_RENEWING_PURCHASE' => $this->consumable($userId, $event),
                default => null,
            };
            $this->done($event['id']);
        });

        BillingUpdated::dispatch($userId);

        return 'processed';
    }

    /** L'identifiant d'utilisateur RevenueCat est `users.id` (fixé par l'application à la connexion). */
    private function resolveUser(array $event): ?string
    {
        $id = (string) ($event['app_user_id'] ?? '');

        return Str::isUuid($id) && DB::table('users')->where('id', $id)->exists() ? strtolower($id) : null;
    }

    private function done(string $eventId, ?string $error = null): void
    {
        DB::table('webhook_events')->where('id', $eventId)->update(['processed_at' => now(), 'error' => $error]);
    }

    private function store(array $event): string
    {
        return config('billing.stores.'.($event['store'] ?? ''), 'apple');
    }

    private function date(mixed $ms, ?CarbonImmutable $fallback = null): CarbonImmutable
    {
        return is_numeric($ms) ? CarbonImmutable::createFromTimestampMs((int) $ms) : ($fallback ?? CarbonImmutable::now());
    }

    private function activate(string $userId, array $event): void
    {
        $original = (string) ($event['original_transaction_id'] ?? $event['transaction_id'] ?? '');
        if ($original === '') {
            return;
        }

        $start = $this->date($event['purchased_at_ms'] ?? null);
        $end = $this->date($event['expiration_at_ms'] ?? null, $start->addMonth());
        if ($end <= $start) {
            $end = $start->addMinute();
        }

        $existing = DB::table('subscriptions')->where('original_transaction_id', $original)->first();
        $values = ['user_id' => $userId, 'store' => $this->store($event), 'product_id' => (string) ($event['product_id'] ?? ''), 'status' => 'active',
            'period_start' => $start, 'period_end' => $end, 'updated_at' => now()];

        $existing
            ? DB::table('subscriptions')->where('id', $existing->id)->update($values)
            : DB::table('subscriptions')->insert($values + ['id' => (string) Str::uuid(), 'original_transaction_id' => $original, 'created_at' => now()]);
    }

    private function setStatus(array $event, string $status): void
    {
        $original = (string) ($event['original_transaction_id'] ?? $event['transaction_id'] ?? '');
        if ($original !== '') {
            DB::table('subscriptions')->where('original_transaction_id', $original)->update(['status' => $status, 'updated_at' => now()]);
        }
    }

    /**
     * Annulation. Un remboursement (motif « support client ») retire l'accès tout de suite et reprend les crédits ;
     * une annulation ordinaire garde l'accès jusqu'à la fin de la période payée.
     */
    private function cancel(string $userId, array $event): void
    {
        $refund = ($event['cancel_reason'] ?? '') === 'CUSTOMER_SUPPORT';
        $productId = (string) ($event['product_id'] ?? '');

        if (isset(config('billing.packs')[$productId])) {
            if ($refund) {
                $this->refundPack($userId, $event);
            }

            return;
        }

        $original = (string) ($event['original_transaction_id'] ?? $event['transaction_id'] ?? '');
        if ($original === '') {
            return;
        }

        DB::table('subscriptions')->where('original_transaction_id', $original)->update(
            // Remboursé : le statut suffit à retirer l'accès (Premium::active l'exclut) ; period_end reste inchangé
            // car la base impose period_end > period_start.
            ['status' => $refund ? 'refunded' : 'cancelled', 'updated_at' => now()]
        );
    }

    private function consumable(string $userId, array $event): void
    {
        $pack = config('billing.packs')[(string) ($event['product_id'] ?? '')] ?? null;
        $tx = (string) ($event['transaction_id'] ?? '');
        if ($pack === null || $tx === '') {
            return;
        }

        $created = DB::table('purchases')->insertOrIgnore([
            'id' => (string) Str::uuid(), 'user_id' => $userId, 'store' => $this->store($event), 'product_id' => $event['product_id'],
            'price_cents' => isset($event['price']) ? (int) round(((float) $event['price']) * 100) : null, 'currency' => $event['currency'] ?? null,
            'transaction_id' => $tx, 'status' => 'completed', 'created_at' => now(), 'updated_at' => now(),
        ]);

        if ($created > 0) {
            DB::table('credit_ledger')->insert([
                'id' => (string) Str::uuid(), 'user_id' => $userId, 'credit_type' => $pack['type'], 'delta' => $pack['credits'], 'reason' => 'purchase',
                'ref_type' => 'purchase', 'idempotency_key' => 'purchase:'.$tx, 'created_at' => now(),
            ]);
        }
    }

    /** Reprend les crédits d'un achat remboursé, sans jamais descendre sous zéro. */
    private function refundPack(string $userId, array $event): void
    {
        $tx = (string) ($event['transaction_id'] ?? '');
        $pack = config('billing.packs')[(string) $event['product_id']];
        $purchase = DB::table('purchases')->where('transaction_id', $tx)->where('user_id', $userId)->first();
        if ($purchase === null || $purchase->status === 'refunded') {
            return;
        }

        DB::table('purchases')->where('id', $purchase->id)->update(['status' => 'refunded', 'updated_at' => now()]);

        $balance = (int) DB::table('credit_ledger')->where('user_id', $userId)->where('credit_type', $pack['type'])->sum('delta');
        $take = min($balance, $pack['credits']);
        if ($take > 0) {
            DB::table('credit_ledger')->insert([
                'id' => (string) Str::uuid(), 'user_id' => $userId, 'credit_type' => $pack['type'], 'delta' => -$take, 'reason' => 'refund_reversal',
                'ref_type' => 'purchase', 'ref_id' => $purchase->id, 'idempotency_key' => 'refund:'.$tx, 'note' => $take < $pack['credits'] ? 'crédits déjà dépensés en partie' : null,
                'created_at' => now(),
            ]);
        }
        if ($take < $pack['credits']) {
            DB::table('risk_events')->insert(['id' => (string) Str::uuid(), 'user_id' => $userId, 'signal' => 'refund_after_spend', 'weight' => 10, 'created_at' => now()]);
        }
    }
}
