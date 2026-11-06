<?php

namespace Tests\Feature\Admin\Support;

use App\Models\StaffUser;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** Jeux de données des tests d'administration (insertions directes : le schéma SQL est la référence). */
final class Seed
{
    public const PASSWORD = 'correct-horse-battery-staple';

    public static function staff(string $role = 'admin', bool $twoFactor = true, bool $active = true, ?string $email = null): StaffUser
    {
        $staff = new StaffUser;
        $staff->forceFill([
            'email' => $email ?? $role.'-'.Str::random(6).'@staff.test',
            'password' => self::PASSWORD,
            'role' => $role,
            'is_active' => $active,
            'totp_secret_encrypted' => $twoFactor ? 'JBSWY3DPEHPK3PXP' : null,
        ])->save();

        return $staff;
    }

    public static function user(string $name = 'Awa', string $status = 'active', array $extra = []): User
    {
        $user = User::factory()->create(['birthdate' => '1990-01-01']);
        DB::table('users')->where('id', $user->id)->update(['status' => $status] + $extra);
        DB::table('profiles')->insert([
            'id' => (string) Str::uuid(), 'user_id' => $user->id, 'display_name' => $name, 'gender' => 'woman', 'origin_country' => 'CM',
            'residence_country' => 'FR', 'intent' => 'flirt', 'created_at' => now(), 'updated_at' => now(),
        ]);

        return $user->fresh();
    }

    public static function report(string $reportedId, string $reason = 'harassment', int $priority = 0, ?string $reporterId = null, ?\DateTimeInterface $at = null): string
    {
        $reporterId ??= self::user('Reporter'.Str::random(3))->id;
        $id = (string) Str::uuid();
        DB::table('reports')->insert([
            'id' => $id, 'reporter_id' => $reporterId, 'reported_id' => $reportedId, 'reason' => $reason, 'priority' => $priority, 'status' => 'open',
            'created_at' => $at ?? now(), 'updated_at' => now(),
        ]);

        return $id;
    }

    /** Signalement « mineur suspecté » avec sa suspension préventive, comme le fait ReportController. */
    public static function minorReport(string $reportedId): string
    {
        $id = self::report($reportedId, 'minor_suspected', 2);
        DB::table('users')->where('id', $reportedId)->update(['status' => 'suspended']);
        DB::table('sanctions')->insert([
            'id' => (string) Str::uuid(), 'user_id' => $reportedId, 'kind' => 'suspension', 'reason' => 'preventive_minor_suspected',
            'report_id' => $id, 'starts_at' => now()->subMinutes(5), 'created_at' => now()->subMinutes(5),
        ]);

        return $id;
    }

    public static function media(string $userId, string $kind = 'profile_photo', string $status = 'processing', ?string $key = null): string
    {
        $id = (string) Str::uuid();
        $position = (int) DB::table('media')->where('user_id', $userId)->count();
        DB::table('media')->insert([
            'id' => $id, 'user_id' => $userId, 'kind' => $kind, 'status' => $status, 'storage_key' => $key ?? "u/{$userId}/{$id}.jpg",
            'mime_type' => 'image/jpeg', 'size_bytes' => 12345, 'position' => min($position, 11), 'created_at' => now(), 'updated_at' => now(),
        ]);

        return $id;
    }

    /** @return array{0: string, 1: string} [demande, média selfie] */
    public static function verification(string $userId): array
    {
        $media = self::media($userId, 'verification_selfie', 'processing', "u/{$userId}/selfie.jpg");
        $id = (string) Str::uuid();
        DB::table('verification_requests')->insert([
            'id' => $id, 'user_id' => $userId, 'selfie_media_id' => $media, 'pose_code' => 'pouce levé', 'status' => 'pending',
            'created_at' => now(), 'updated_at' => now(),
        ]);
        DB::table('profiles')->where('user_id', $userId)->update(['verification_status' => 'pending']);

        return [$id, $media];
    }

    public static function sanction(string $userId, string $kind = 'suspension', ?\DateTimeInterface $endsAt = null, string $reason = 'abus', ?string $reportId = null): string
    {
        $id = (string) Str::uuid();
        DB::table('sanctions')->insert([
            'id' => $id, 'user_id' => $userId, 'kind' => $kind, 'reason' => $reason, 'report_id' => $reportId,
            'starts_at' => now()->subDay(), 'ends_at' => $endsAt, 'created_at' => now()->subDay(),
        ]);

        return $id;
    }

    public static function appeal(string $sanctionId, string $userId): string
    {
        $id = (string) Str::uuid();
        DB::table('appeals')->insert([
            'id' => $id, 'sanction_id' => $sanctionId, 'user_id' => $userId, 'message' => 'Je conteste cette décision, voici pourquoi.',
            'status' => 'open', 'created_at' => now(), 'updated_at' => now(),
        ]);

        return $id;
    }

    public static function ticket(string $userId, string $status = 'open'): string
    {
        $id = (string) Str::uuid();
        DB::table('support_tickets')->insert([
            'id' => $id, 'user_id' => $userId, 'subject' => 'Problème de paiement', 'body' => 'Mon achat n\'apparaît pas.', 'status' => $status,
            'created_at' => now(), 'updated_at' => now(),
        ]);

        return $id;
    }

    public static function audit(string $action): ?object
    {
        return DB::table('audit_logs')->where('action', $action)->orderByDesc('id')->first();
    }

    public static function auditCount(?string $action = null): int
    {
        return DB::table('audit_logs')->when($action, fn ($q) => $q->where('action', $action))->count();
    }
}
