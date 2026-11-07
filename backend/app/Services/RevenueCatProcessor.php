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
 * Sandbox : les événements `environment = SANDBOX` sont acquittés mais jamais appliqués en production.
 * Ordre : `subscriptions.last_event_ms` garde l'`event_timestamp_ms` du dernier événement appliqué ; un événement plus ancien est ignoré.
 *
 * Types d'événements traités (noms à confirmer dans la documentation officielle de RevenueCat avant la mise en production) :
 * INITIAL_PURCHASE, RENEWAL, UNCANCELLATION, PRODUCT_CHANGE, CANCELLATION, EXPIRATION, BILLING_ISSUE, NON_RENEWING_PURCHASE.
 */
class RevenueCatProcessor
{
    /**
     * @param  array<string, mixed>  $payload
     * @return string processed|duplicate|ignored
     *
     * Un événement n'est « traité » que lorsque `processed_at` est renseigné, dans la MÊME transaction que ses effets.
     * Si le traitement échoue, rien n'est marqué : le rejeu de RevenueCat est alors retraité (revue F-08).
     * Un événement pour un utilisateur inconnu est conservé sans `processed_at` : un rejeu ultérieur (après la
     * connexion de l'utilisateur) pourra l'appliquer.
     */
    public function handle(array $payload): string
    {
        $event = $payload['event'] ?? null;
        if (! is_array($event) || empty($event['id']) || empty($event['type'])) {
            return 'ignored';
        }

        $id = (string) $event['id'];
        DB::table('webhook_events')->insertOrIgnore(['id' => $id, 'payload' => json_encode($payload), 'created_at' => now()]);

        $row = DB::table('webhook_events')->where('id', $id)->first();
        if ($row->processed_at !== null) {
            return 'duplicate';
        }

        // Revue F-13 : les achats de test (TestFlight, testeurs Play) sont gratuits ; en production, l'événement SANDBOX
        // est acquitté (200) et conservé pour trace, mais jamais appliqué.
        if (app()->isProduction() && strtoupper((string) ($event['environment'] ?? '')) === 'SANDBOX') {
            $this->done($id, 'environnement sandbox ignoré');

            return 'ignored';
        }

        $userId = $this->resolveUser($event);
        if ($userId === null) {
            DB::table('webhook_events')->where('id', $id)->update(['error' => 'utilisateur inconnu']);

            return 'ignored';
        }

        $stale = false;
        DB::transaction(function () use ($event, $userId, &$stale) {
            $applied = match ($event['type']) {
                'INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE' => $this->activate($userId, $event),
                'BILLING_ISSUE' => $this->setStatus($event, 'grace'),
                'EXPIRATION' => $this->setStatus($event, 'expired'),
                'CANCELLATION' => $this->cancel($userId, $event),
                'NON_RENEWING_PURCHASE' => $this->consumable($userId, $event),
                default => true,
            };
            $stale = $applied === false;
            $this->done($event['id'], $stale ? "événement plus ancien que l'état courant, ignoré" : null);
        });

        if ($stale) {
            return 'ignored';
        }

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

    /** Horodatage de l'événement chez RevenueCat (ms), ou null s'il est absent ou invalide. */
    private function eventMs(array $event): ?int
    {
        $ms = $event['event_timestamp_ms'] ?? null;

        return is_numeric($ms) && (int) $ms > 0 ? (int) $ms : null;
    }

    /** Revue F-13 : un événement plus ancien que le dernier appliqué à cet abonnement (réessai tardif) ne doit pas écraser l'état. */
    private function isStale(?object $subscription, array $event): bool
    {
        $ts = $this->eventMs($event);

        return $subscription !== null && $ts !== null && $subscription->last_event_ms !== null && $ts < (int) $subscription->last_event_ms;
    }

    /** @return array<string, int> colonne à écrire pour garder le plus récent horodatage appliqué */
    private function stamp(array $event, ?object $subscription): array
    {
        $ts = $this->eventMs($event);

        return $ts === null ? [] : ['last_event_ms' => max($ts, (int) ($subscription->last_event_ms ?? 0))];
    }

    private function store(array $event): string
    {
        return config('billing.stores.'.($event['store'] ?? ''), 'apple');
    }

    private function date(mixed $ms, ?CarbonImmutable $fallback = null): CarbonImmutable
    {
        return is_numeric($ms) ? CarbonImmutable::createFromTimestampMs((int) $ms) : ($fallback ?? CarbonImmutable::now());
    }

    /** @return bool false si l'événement est périmé (rien n'a été changé) */
    private function activate(string $userId, array $event): bool
    {
        $original = (string) ($event['original_transaction_id'] ?? $event['transaction_id'] ?? '');
        if ($original === '') {
            return true;
        }

        $start = $this->date($event['purchased_at_ms'] ?? null);
        $end = $this->date($event['expiration_at_ms'] ?? null, $start->addMonth());
        if ($end <= $start) {
            $end = $start->addMinute();
        }

        $existing = DB::table('subscriptions')->where('original_transaction_id', $original)->lockForUpdate()->first();
        if ($this->isStale($existing, $event)) {
            return false;
        }

        $values = $this->stamp($event, $existing) + ['user_id' => $userId, 'store' => $this->store($event), 'product_id' => (string) ($event['product_id'] ?? ''), 'status' => 'active',
            'period_start' => $start, 'period_end' => $end, 'updated_at' => now()];

        $existing
            ? DB::table('subscriptions')->where('id', $existing->id)->update($values)
            : DB::table('subscriptions')->insert($values + ['id' => (string) Str::uuid(), 'original_transaction_id' => $original, 'created_at' => now()]);

        return true;
    }

    private function setStatus(array $event, string $status): bool
    {
        $original = (string) ($event['original_transaction_id'] ?? $event['transaction_id'] ?? '');
        if ($original === '') {
            return true;
        }

        $existing = DB::table('subscriptions')->where('original_transaction_id', $original)->lockForUpdate()->first();
        if ($existing === null) {
            return true;
        }
        if ($this->isStale($existing, $event)) {
            return false;
        }

        DB::table('subscriptions')->where('id', $existing->id)->update($this->stamp($event, $existing) + ['status' => $status, 'updated_at' => now()]);

        return true;
    }

    /**
     * Annulation. Un remboursement (motif « support client ») retire l'accès tout de suite et reprend les crédits ;
     * une annulation ordinaire garde l'accès jusqu'à la fin de la période payée.
     */
    private function cancel(string $userId, array $event): bool
    {
        $refund = ($event['cancel_reason'] ?? '') === 'CUSTOMER_SUPPORT';
        $productId = (string) ($event['product_id'] ?? '');

        if (isset(config('billing.packs')[$productId])) {
            if ($refund) {
                $this->refundPack($userId, $event);
            }

            return true;
        }

        $original = (string) ($event['original_transaction_id'] ?? $event['transaction_id'] ?? '');
        if ($original === '') {
            return true;
        }

        $existing = DB::table('subscriptions')->where('original_transaction_id', $original)->lockForUpdate()->first();
        if ($existing === null) {
            return true;
        }
        if ($this->isStale($existing, $event)) {
            return false;
        }

        DB::table('subscriptions')->where('id', $existing->id)->update($this->stamp($event, $existing) + [
            // Remboursé : le statut suffit à retirer l'accès (Premium::active l'exclut) ; period_end reste inchangé
            // car la base impose period_end > period_start.
            'status' => $refund ? 'refunded' : 'cancelled', 'updated_at' => now(),
        ]);

        return true;
    }

    private function consumable(string $userId, array $event): bool
    {
        $pack = config('billing.packs')[(string) ($event['product_id'] ?? '')] ?? null;
        $tx = (string) ($event['transaction_id'] ?? '');
        if ($pack === null || $tx === '') {
            return true;
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

        return true;
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
