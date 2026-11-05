<?php

namespace App\Services;

use App\Models\User;
use App\Services\Storage\MediaStorage;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

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

        foreach ($due as $user) {
            $this->anonymize($user);
        }

        return $due->count();
    }

    public function anonymize(User $user): void
    {
        $keys = DB::table('media')->where('user_id', $user->id)->pluck('storage_key');
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
                'verification_codes', 'notification_prefs', 'daily_counters', 'data_exports'] as $table) {
                DB::table($table)->where('user_id', $user->id)->delete();
            }

            DB::table('matches')->where('user_a', $user->id)->orWhere('user_b', $user->id)->update(['status' => 'unmatched', 'updated_at' => now()]);
            DB::table('conversations')->where('user_a', $user->id)->orWhere('user_b', $user->id)->update(['status' => 'archived', 'updated_at' => now()]);
            DB::table('blocks')->where('blocker_id', $user->id)->delete();
            $user->tokens()->delete();

            DB::table('users')->where('id', $user->id)->update([
                'email' => null, 'phone' => null, 'password' => null, 'status' => 'deleted', 'email_verified_at' => null, 'phone_verified_at' => null, 'updated_at' => now(),
            ]);
        });
    }

    private function remember(string $kind, string $value): void
    {
        DB::table('banned_identifiers')->insertOrIgnore([
            'id' => (string) Str::uuid(), 'kind' => $kind, 'value_hash' => hash_hmac('sha256', strtolower($value), (string) config('app.key')),
            'reason' => 'sanctioned_account_deleted', 'created_at' => now(),
        ]);
    }
}
