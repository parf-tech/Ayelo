<?php

use App\Filament\Models\Member;
use App\Filament\Resources\MemberResource;
use App\Models\StaffUser;
use Filament\Facades\Filament;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Admin\Support\Seed;

beforeEach(function () {
    Filament::setCurrentPanel('admin');
});

it('n’affiche jamais mot de passe, secret TOTP, jeton ni clé de stockage dans aucune page', function () {
    $admin = Seed::staff('admin');
    $staffHash = DB::table('staff_users')->where('id', $admin->id)->value('password');
    $staffSecretEncrypted = DB::table('staff_users')->where('id', $admin->id)->value('totp_secret_encrypted');

    $user = Seed::user('Awa');
    $userHash = DB::table('users')->where('id', $user->id)->value('password');
    $token = $user->createToken('mobile')->plainTextToken;
    [$req] = Seed::verification($user->id);
    $mediaId = Seed::media($user->id, 'profile_photo', 'processing', "u/{$user->id}/secret-object-key.jpg");
    $report = Seed::report($user->id);
    $appeal = Seed::appeal(Seed::sanction($user->id), $user->id);
    $ticket = Seed::ticket($user->id);
    app(\App\Services\Admin\UserAdmin::class)->adjustCredits($admin, $user->id, 'coin', 3, 'Compensation test');
    $entry = DB::table('audit_logs')->value('id');

    $this->actingAs($admin, 'staff');
    $forbidden = [$staffHash, $staffSecretEncrypted, 'JBSWY3DPEHPK3PXP', $userHash, explode('|', $token)[1] ?? $token, 'secret-object-key', Seed::PASSWORD];

    foreach (['/admin', '/admin/profile', '/admin/users', "/admin/users/{$user->id}", '/admin/media-queue', '/admin/reports', "/admin/reports/{$report}",
        '/admin/appeals', "/admin/appeals/{$appeal}", '/admin/verifications', "/admin/verifications/{$req}", '/admin/tickets', "/admin/tickets/{$ticket}",
        '/admin/audit-log', "/admin/audit-log/{$entry}"] as $path) {
        $body = $this->get($path)->assertOk()->getContent();
        foreach ($forbidden as $secret) {
            // L'aperçu d'un média à modérer est une URL signée courte qui contient forcément la clé d'objet.
            if ($path === '/admin/media-queue' && $secret === 'secret-object-key') {
                continue;
            }
            expect(str_contains($body, (string) $secret))->toBeFalse("{$path} contient " . substr((string) $secret, 0, 6) . '…');
        }
    }
});

it('ne charge jamais le hash du mot de passe des utilisateurs dans le back-office', function () {
    Seed::user('Awa');

    expect(MemberResource::getEloquentQuery()->toSql())->not->toContain('users.password')->and(MemberResource::getEloquentQuery()->toSql())->not->toContain('*');
    $member = MemberResource::getEloquentQuery()->first();
    expect($member->getAttributes())->not->toHaveKey('password')->and($member->toArray())->not->toHaveKey('password');
    expect((new Member)->getHidden())->toContain('password');
});

it('cache mot de passe et secrets du personnel à la sérialisation', function () {
    $staff = Seed::staff('admin');
    $staff->recovery_codes_encrypted = ['abc', 'def'];
    $staff->save();

    $array = $staff->fresh()->toArray();
    expect($array)->not->toHaveKeys(['password', 'totp_secret_encrypted', 'recovery_codes_encrypted']);
    expect(json_encode($staff->fresh()))->not->toContain('JBSWY3DPEHPK3PXP')->and(json_encode($staff->fresh()))->not->toContain('abc');
    $raw = DB::table('staff_users')->where('id', $staff->id)->value('recovery_codes_encrypted');
    expect($raw)->not->toContain('abc');
    expect(StaffUser::find($staff->id)->recovery_codes_encrypted)->toBe(['abc', 'def']);
});

it('le journal d’audit ne contient jamais de secret après connexion, ajustement et création de compte', function () {
    $admin = Seed::staff('admin');
    $this->actingAs($admin, 'staff');
    app(\App\Services\Admin\UserAdmin::class)->adjustCredits($admin, Seed::user()->id, 'coin', 2, 'Test sans secret');
    app(\App\Services\Admin\StaffAccounts::class)->create('nouveau@staff.test', 'support', 'mot-de-passe-secret-123');

    $all = json_encode(DB::table('audit_logs')->get());
    expect($all)->not->toContain('mot-de-passe-secret-123')->and($all)->not->toContain('JBSWY3DPEHPK3PXP')->and($all)->not->toContain(Seed::PASSWORD);
});
