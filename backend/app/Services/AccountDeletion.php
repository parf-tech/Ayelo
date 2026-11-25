<?php

namespace App\Services;

use App\Models\User;
use App\Services\Admin\SanctionLedger;
use App\Services\OAuth\AppleRevocationFailed;
use App\Services\OAuth\AppleTokens;
use App\Services\Storage\MediaStorage;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Suppression de compte en deux temps (FR-A-8) :
 * 1. demande : le profil est masqué tout de suite, les sessions sont fermées, le compte passe en « deleting » ;
 * 2. après 30 jours : anonymisation (données personnelles effacées). La ligne `users` minimale est conservée tant
 *    que des signalements ou sanctions la référencent (clés étrangères `restrict`), et un hash de l'e-mail est gardé
 *    si le compte a été sanctionné, pour empêcher un contournement de bannissement.
 */
class AccountDeletion
{
    public const GRACE_DAYS = 30;

    /** Remplace sanctions.reason (colonne obligatoire) une fois sa durée de conservation écoulée. */
    public const PURGED_REASON = '[purgé]';

    public function __construct(private DeviceSessions $sessions, private MediaStorage $storage) {}

    public function request(User $user): void
    {
        DB::transaction(function () use ($user) {
            $user->forceFill(['status' => 'deleting', 'deletion_requested_at' => now()])->save();
            DB::table('profiles')->where('user_id', $user->id)->update(['is_visible' => false, 'updated_at' => now()]);
            $this->sessions->revokeAll($user);
        });
    }

    /** Date de l'anonymisation d'un compte dont la suppression a été demandée. */
    public function purgeAt(User $user): CarbonImmutable
    {
        return CarbonImmutable::parse($user->getAttribute('deletion_requested_at'))->addDays(self::GRACE_DAYS);
    }

    /** Compte en cours de suppression et encore dans son délai de grâce : la suppression peut être annulée. */
    public function isCancellable(User $user): bool
    {
        return $user->getAttribute('status') === 'deleting' && $user->getAttribute('deletion_requested_at') !== null && $this->purgeAt($user)->isFuture();
    }

    /**
     * Annule la suppression demandée. Le statut d'avant la demande n'est pas conservé : il est recalculé depuis les sanctions
     * (un bannissement ou une suspension en vigueur survit à la suppression demandée puis annulée ; une suspension expirée entre-temps non).
     * Le profil reste masqué : l'ayant masqué lors de la demande, le réafficher est un choix de la personne (réglages du profil).
     * Mise à jour conditionnelle : face à une purge qui démarre au même instant, une seule des deux opérations l'emporte
     * (la purge ne retient que les demandes de plus de GRACE_DAYS jours, l'annulation que celles de moins).
     *
     * @return bool faux si le compte n'est plus annulable (déjà purgé ou délai écoulé)
     */
    public function cancel(User $user): bool
    {
        $restrictions = app(SanctionLedger::class)->activeRestrictions((string) $user->id);
        $status = $restrictions->contains(fn ($s) => $s->kind === 'ban') ? 'banned' : ($restrictions->isNotEmpty() ? 'suspended' : 'active');

        return DB::table('users')->where('id', $user->id)->where('status', 'deleting')
            ->where('deletion_requested_at', '>', now()->subDays(self::GRACE_DAYS))
            ->update(['status' => $status, 'deletion_requested_at' => null, 'updated_at' => now()]) > 0;
    }

    /** Anonymise les comptes dont le délai de grâce est écoulé. @return int nombre de comptes traités */
    public function purgeDue(): int
    {
        $due = User::where('status', 'deleting')->where('deletion_requested_at', '<=', now()->subDays(self::GRACE_DAYS))->get();

        // Une panne (stockage objet, base) sur un compte ne doit pas bloquer les suivants : il reste « deleting » et sera repris au prochain passage.
        $done = 0;
        foreach ($due as $user) {
            try {
                $this->anonymize($user);
                $done++;
            } catch (\Throwable $e) {
                Log::error('Anonymisation différée', ['user_id' => $user->id, 'error' => $e::class]);
            }
        }

        $this->purgeRetainedText();

        return $done;
    }

    /**
     * Anonymise les comptes créés par e-mail et mot de passe dont l'adresse n'a JAMAIS été vérifiée et qui n'ont aucune activité depuis
     * `retention.unverified_account_days` jours (compte créé, jamais vu, aucun jeton utilisé). Jamais touchés : un compte vérifié (e-mail
     * ou téléphone), social, payant (achat, abonnement, registre de crédits), visé par un signalement ou une sanction, en suppression.
     * Une panne sur un compte ne bloque pas les suivants : il reste actif et sera repris au passage suivant.
     *
     * @return int nombre de comptes anonymisés
     */
    public function purgeUnverified(): int
    {
        $limit = now()->subDays(max(1, (int) config('retention.unverified_account_days', 30)));
        $has = fn (string $table, string $column) => fn ($q) => $q->select(DB::raw(1))->from($table)->whereColumn($table.'.'.$column, 'users.id');

        $candidates = User::query()->where('status', 'active')->whereNull('email_verified_at')->whereNull('phone_verified_at')->whereNotNull('password')
            ->where('created_at', '<=', $limit)
            ->where(fn ($q) => $q->whereNull('last_seen_at')->orWhere('last_seen_at', '<=', $limit))
            ->whereNotExists(fn ($q) => $q->select(DB::raw(1))->from('personal_access_tokens')->whereColumn('personal_access_tokens.tokenable_id', 'users.id')
                ->where('personal_access_tokens.last_used_at', '>', $limit))
            ->whereNotExists($has('auth_identities', 'user_id'))
            ->whereNotExists($has('purchases', 'user_id'))
            ->whereNotExists($has('subscriptions', 'user_id'))
            ->whereNotExists($has('credit_ledger', 'user_id'))
            ->whereNotExists($has('reports', 'reported_id'))
            ->whereNotExists($has('sanctions', 'user_id'))
            ->get();

        $done = 0;
        foreach ($candidates as $user) {
            try {
                $this->anonymize($user);
                $done++;
            } catch (\Throwable $e) {
                Log::error('Anonymisation d\'un compte jamais vérifié', ['user_id' => $user->id, 'error' => $e::class]);
            }
        }

        return $done;
    }

    /**
     * Texte libre dont la durée de conservation est écoulée (revue F-06). Ne touche que les dossiers dont une partie est déjà
     * anonymisée : reports.details est mis à null ; sanctions.reason (obligatoire) est remplacé par le marqueur PURGED_REASON.
     * Les signalements encore sous conservation probatoire (evidence_retain_until) sont épargnés.
     *
     * @return array{reports: int, sanctions: int}
     */
    public function purgeRetainedText(): array
    {
        $deleted = DB::table('users')->select('id')->where('status', 'deleted');

        $reports = DB::table('reports')->whereNotNull('details')
            ->where('created_at', '<=', now()->subDays((int) config('retention.report_details_days', 365)))
            ->where(fn ($q) => $q->whereNull('evidence_retain_until')->orWhere('evidence_retain_until', '<=', now()))
            ->where(fn ($q) => $q->whereIn('reported_id', $deleted)->orWhereIn('reporter_id', $deleted))
            ->update(['details' => null, 'updated_at' => now()]);

        $sanctions = DB::table('sanctions')->where('reason', '<>', self::PURGED_REASON)
            ->where('created_at', '<=', now()->subDays((int) config('retention.sanction_reason_days', 365)))
            ->whereIn('user_id', $deleted)
            ->update(['reason' => self::PURGED_REASON]);

        return ['reports' => $reports, 'sanctions' => $sanctions];
    }

    public function anonymize(User $user): void
    {
        // Avant toute suppression : un échec de révocation interrompt tout, le compte sera repris au prochain passage.
        $this->revokeAppleTokens($user);

        $keys = DB::table('media')->where('user_id', $user->id)->pluck('storage_key')
            ->merge(DB::table('data_exports')->where('user_id', $user->id)->whereNotNull('storage_key')->pluck('storage_key'));
        foreach ($keys as $key) {
            $this->storage->delete($key);
        }

        DB::transaction(function () use ($user) {
            $sanctioned = DB::table('sanctions')->where('user_id', $user->id)->whereIn('kind', ['suspension', 'ban'])->exists();
            if ($sanctioned && $user->email) {
                $this->remember('email', $user->email);
            }
            if ($sanctioned && $user->phone) {
                $this->remember('phone', $user->phone);
            }

            // Messages envoyés : contenu effacé, la conversation reste pour l'autre personne (« compte supprimé »).
            DB::table('messages')->where('sender_id', $user->id)->update(['body' => null, 'media_id' => null, 'deleted_at' => now(), 'updated_at' => now()]);

            DB::table('swipes')->where('swiper_id', $user->id)->orWhere('target_id', $user->id)->delete();
            foreach (['media', 'stories', 'video_invites', 'verification_requests', 'preferences', 'profiles', 'devices', 'auth_identities',
                'verification_codes', 'notification_prefs', 'daily_counters', 'data_exports', 'support_tickets', 'appeals'] as $table) {
                DB::table($table)->where('user_id', $user->id)->delete();
            }
            DB::table('story_views')->where('viewer_id', $user->id)->delete();
            DB::table('story_audience')->where('viewer_id', $user->id)->delete();
            DB::table('call_sessions')->where('caller_id', $user->id)->orWhere('callee_id', $user->id)->delete();
            DB::table('gift_sends')->where('sender_id', $user->id)->orWhere('receiver_id', $user->id)->delete();

            // Conservé comme preuve de consentement, mais sans l'adresse IP.
            DB::table('user_consents')->where('user_id', $user->id)->update(['ip' => null]);
            // Charges utiles RevenueCat brutes (identifiant d'utilisateur) : effacées.
            DB::table('webhook_events')->whereRaw("payload->'event'->>'app_user_id' = ?", [$user->id])->update(['payload' => '{}']);
            // Signaux de risque : conservés seulement si le compte a été sanctionné (lutte contre le contournement).
            if (! $sanctioned) {
                DB::table('risk_events')->where('user_id', $user->id)->delete();
            }

            DB::table('matches')->where('user_a', $user->id)->orWhere('user_b', $user->id)->update(['status' => 'unmatched', 'updated_at' => now()]);
            DB::table('conversations')->where('user_a', $user->id)->orWhere('user_b', $user->id)->update(['status' => 'archived', 'updated_at' => now()]);
            DB::table('blocks')->where('blocker_id', $user->id)->delete();
            $user->tokens()->delete();

            DB::table('users')->where('id', $user->id)->update([
                'email' => null, 'phone' => null, 'password' => null, 'status' => 'deleted', 'email_verified_at' => null, 'phone_verified_at' => null,
                // Date de naissance généralisée à l'année (minimisation) ; le déclencheur n'autorise que ce passage.
                'birthdate' => DB::raw("date_trunc('year', birthdate)::date"),
                'last_seen_at' => null, 'risk_score' => $sanctioned ? DB::raw('risk_score') : 0, 'updated_at' => now(),
            ]);
        });
    }

    /**
     * Révoque les jetons « Se connecter avec Apple » du compte (exigence d'Apple). Apple injoignable : l'exception remonte et la
     * purge réessaie au passage suivant ; au-delà de GRACE_DAYS + 7 jours, l'effacement des données personnelles prime et l'échec
     * est seulement journalisé. Configuration Apple absente ou jeton illisible (clé d'application changée) : journalisé, pas de blocage.
     */
    private function revokeAppleTokens(User $user): void
    {
        $tokens = DB::table('auth_identities')->where('user_id', $user->id)->where('provider', 'apple')
            ->whereNotNull('provider_refresh_token')->pluck('provider_refresh_token');
        if ($tokens->isEmpty()) {
            return;
        }

        $apple = app(AppleTokens::class);
        if (! $apple->configured()) {
            Log::warning('Jeton Apple non révoqué : configuration APPLE_* absente', ['user_id' => $user->id]);

            return;
        }

        foreach ($tokens as $encrypted) {
            try {
                $apple->revoke(Crypt::decryptString($encrypted));
            } catch (DecryptException) {
                Log::error('Jeton Apple illisible, non révoqué', ['user_id' => $user->id]);
            } catch (AppleRevocationFailed $e) {
                if ($user->getAttribute('deletion_requested_at') === null || ! $this->purgeAt($user)->addDays(7)->isPast()) {
                    throw $e;
                }
                Log::error('Jeton Apple non révoqué, purge poursuivie', ['user_id' => $user->id, 'error' => $e->getMessage()]);
            }
        }
    }

    private function remember(string $kind, string $value): void
    {
        BannedIdentifiers::remember($kind, $value, 'sanctioned_account_deleted');
    }
}
