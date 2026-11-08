<?php

namespace App\Services;

use App\Models\User;
use App\Services\Storage\MediaStorage;
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

    private function remember(string $kind, string $value): void
    {
        BannedIdentifiers::remember($kind, $value, 'sanctioned_account_deleted');
    }
}
