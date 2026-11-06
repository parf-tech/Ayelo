<?php

namespace App\Services\Admin;

use App\Models\StaffUser;
use DomainException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Actions manuelles sur un utilisateur : suspension, bannissement, réactivation, crédits, Premium offert.
 * Chaque sanction manuelle écrit une ligne `sanctions` (visible et contestable dans l'API), comme pour un signalement.
 */
class UserAdmin extends AdminService
{
    public const CREDIT_TYPES = ['conversation', 'proposal', 'coin'];

    /** Garde-fous contre une erreur de saisie. */
    public const MAX_CREDIT_DELTA = 1000;
    public const MAX_PREMIUM_DAYS = 366;

    public function __construct(Audit $audit, private SanctionLedger $sanctions)
    {
        parent::__construct($audit);
    }

    public function suspend(StaffUser $actor, string $userId, string $reason, int $days): void
    {
        $reason = $this->reason($reason);
        if ($days < 1 || $days > 365) {
            throw new DomainException('La durée de suspension doit être comprise entre 1 et 365 jours.');
        }

        $this->audited($actor, Permissions::USERS_MANAGE, 'user.suspended', 'users', $userId, function () use ($actor, $userId, $reason, $days) {
            $before = $this->status($userId);
            $sanctionId = $this->sanctions->issue($userId, 'suspension', $reason, null, now()->addDays($days), $actor->id);

            return new Change(null, ['status' => $before], ['status' => 'suspended', 'sanction_id' => $sanctionId, 'reason' => $reason, 'days' => $days]);
        });
    }

    public function ban(StaffUser $actor, string $userId, string $reason): void
    {
        $reason = $this->reason($reason);

        $this->audited($actor, Permissions::USERS_MANAGE, 'user.banned', 'users', $userId, function () use ($actor, $userId, $reason) {
            $before = $this->status($userId);
            $sanctionId = $this->sanctions->issue($userId, 'ban', $reason, null, null, $actor->id);

            return new Change(null, ['status' => $before], ['status' => 'banned', 'sanction_id' => $sanctionId, 'reason' => $reason]);
        });
    }

    /** Réactive un compte suspendu ou banni et termine ses restrictions en vigueur. */
    public function reactivate(StaffUser $actor, string $userId, string $reason): void
    {
        $reason = $this->reason($reason);

        $this->audited($actor, Permissions::USERS_MANAGE, 'user.reactivated', 'users', $userId, function () use ($userId, $reason) {
            $before = $this->status($userId);
            if (! in_array($before, ['suspended', 'banned'], true)) {
                throw new DomainException('Seuls les comptes suspendus ou bannis peuvent être réactivés.');
            }
            foreach ($this->sanctions->activeRestrictions($userId) as $sanction) {
                $this->sanctions->close($sanction);
            }
            $this->sanctions->restoreIfFree($userId);

            return new Change(null, ['status' => $before], ['status' => $this->status($userId), 'reason' => $reason]);
        });
    }

    /**
     * Ajustement manuel du solde (FR-H-6) : ligne `credit_ledger` en ajout seulement, reason `admin_adjust`,
     * created_by = acteur, clé d'idempotence unique (une double soumission n'ajuste qu'une fois).
     */
    public function adjustCredits(StaffUser $actor, string $userId, string $creditType, int $delta, string $note, ?string $idempotencyKey = null): void
    {
        $note = $this->reason($note);
        if (! in_array($creditType, self::CREDIT_TYPES, true)) {
            throw new DomainException('Type de crédit inconnu.');
        }
        if ($delta === 0 || abs($delta) > self::MAX_CREDIT_DELTA) {
            throw new DomainException('L\'ajustement doit être non nul et ne pas dépasser '.self::MAX_CREDIT_DELTA.'.');
        }
        $key = 'admin:'.($idempotencyKey ?? (string) Str::uuid());

        $this->audited($actor, Permissions::CREDITS_ADJUST, 'credits.adjusted', 'users', $userId, function () use ($actor, $userId, $creditType, $delta, $note, $key) {
            // Verrou sur l'utilisateur : sérialise les ajustements concurrents (solde et unicité de la clé).
            $this->lockedUser($userId);
            if (DB::table('credit_ledger')->where('user_id', $userId)->where('idempotency_key', $key)->exists()) {
                throw new DomainException('Cet ajustement a déjà été appliqué.');
            }
            $balance = (int) DB::table('credit_ledger')->where('user_id', $userId)->where('credit_type', $creditType)->sum('delta');
            if ($balance + $delta < 0) {
                throw new DomainException("Le solde ne peut pas devenir négatif (solde actuel : {$balance}).");
            }

            $id = (string) Str::uuid();
            DB::table('credit_ledger')->insert([
                'id' => $id, 'user_id' => $userId, 'credit_type' => $creditType, 'delta' => $delta, 'reason' => 'admin_adjust',
                'ref_type' => null, 'ref_id' => null, 'idempotency_key' => $key, 'note' => $note, 'created_by' => $actor->id, 'created_at' => now(),
            ]);

            return new Change(null, ['credit_type' => $creditType, 'balance' => $balance], ['balance' => $balance + $delta, 'delta' => $delta, 'ledger_id' => $id, 'note' => $note]);
        });
    }

    /** Premium offert : abonnement `promotional`, sans transaction de store, avec `granted_by`. */
    public function grantPremium(StaffUser $actor, string $userId, \DateTimeInterface $endsAt, string $note): void
    {
        $note = $this->reason($note);
        $end = \Illuminate\Support\Carbon::instance($endsAt);
        if ($end->lessThanOrEqualTo(now()->addMinute()) || $end->greaterThan(now()->addDays(self::MAX_PREMIUM_DAYS))) {
            throw new DomainException('La date de fin doit être dans le futur et à moins de '.self::MAX_PREMIUM_DAYS.' jours.');
        }

        $this->audited($actor, Permissions::PREMIUM_GRANT, 'premium.granted', 'users', $userId, function () use ($actor, $userId, $end, $note) {
            $this->lockedUser($userId);
            $id = (string) Str::uuid();
            DB::table('subscriptions')->insert([
                'id' => $id, 'user_id' => $userId, 'store' => 'promotional', 'product_id' => 'premium_promo', 'status' => 'active',
                'period_start' => now(), 'period_end' => $end, 'original_transaction_id' => null, 'granted_by' => $actor->id,
                'created_at' => now(), 'updated_at' => now(),
            ]);

            return new Change(null, null, ['subscription_id' => $id, 'period_end' => $end->toIso8601String(), 'note' => $note]);
        });
    }

    /** Retire un Premium offert (erreur de saisie, abus). Les abonnements des stores ne se touchent pas ici. */
    public function revokePremium(StaffUser $actor, string $subscriptionId, string $note): void
    {
        $note = $this->reason($note);

        $this->audited($actor, Permissions::PREMIUM_GRANT, 'premium.revoked', 'subscriptions', $subscriptionId, function () use ($subscriptionId, $note) {
            $sub = DB::table('subscriptions')->where('id', $subscriptionId)->lockForUpdate()->first();
            if ($sub === null || $sub->store !== 'promotional' || $sub->status !== 'active') {
                throw new DomainException('Seul un Premium offert encore actif peut être retiré.');
            }
            $end = now()->greaterThan(\Illuminate\Support\Carbon::parse($sub->period_start)->addSecond()) ? now() : \Illuminate\Support\Carbon::parse($sub->period_start)->addSecond();
            DB::table('subscriptions')->where('id', $subscriptionId)->update(['status' => 'expired', 'period_end' => $end, 'updated_at' => now()]);

            return new Change(null, ['status' => 'active', 'period_end' => $sub->period_end, 'user_id' => $sub->user_id], ['status' => 'expired', 'note' => $note]);
        });
    }

    private function reason(string $text): string
    {
        $text = trim($text);
        if (mb_strlen($text) < 5) {
            throw new DomainException('Un motif d\'au moins 5 caractères est obligatoire.');
        }

        return $text;
    }

    private function status(string $userId): string
    {
        $status = DB::table('users')->where('id', $userId)->value('status');
        if ($status === null) {
            throw new DomainException('Utilisateur introuvable.');
        }

        return $status;
    }

    private function lockedUser(string $userId): object
    {
        $user = DB::table('users')->where('id', $userId)->lockForUpdate()->first();
        if ($user === null || in_array($user->status, ['deleting', 'deleted'], true)) {
            throw new DomainException('Utilisateur introuvable ou en cours de suppression.');
        }

        return $user;
    }
}
