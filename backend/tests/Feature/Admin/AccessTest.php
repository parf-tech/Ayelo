<?php

use App\Filament\Pages\Auth\StaffLogin;
use App\Models\StaffUser;
use Filament\Facades\Filament;
use Illuminate\Support\Facades\DB;
use Livewire\Livewire;
use PragmaRX\Google2FA\Google2FA;
use Tests\Feature\Admin\Support\Seed;

beforeEach(function () {
    Filament::setCurrentPanel('admin');
});

it('sert le panneau sur /admin avec le garde staff', function () {
    expect(Filament::getPanel('admin')->getPath())->toBe('admin')
        ->and(Filament::getPanel('admin')->getAuthGuard())->toBe('staff')
        ->and(Filament::getPanel('admin')->isMultiFactorAuthenticationRequired())->toBeTrue();
});

it('redirige un visiteur anonyme vers la connexion du personnel', function () {
    $this->get('/admin')->assertRedirect('/admin/login');
    $this->get('/admin/reports')->assertRedirect('/admin/login');
});

it('refuse l’accès aux utilisateurs de l’application, même authentifiés sur le garde web', function () {
    $user = Seed::user();

    $this->actingAs($user, 'web')->get('/admin')->assertRedirect('/admin/login');
    $this->actingAs($user, 'web')->get('/admin/users')->assertRedirect('/admin/login');
});

it('refuse l’accès avec un jeton Sanctum d’utilisateur', function () {
    $user = Seed::user();
    $token = $user->createToken('t')->plainTextToken;

    $this->withHeader('Authorization', 'Bearer '.$token)->get('/admin')->assertRedirect('/admin/login');
});

it('ne laisse un compte sans 2FA voir que l’écran de configuration', function () {
    $staff = Seed::staff('admin', twoFactor: false);
    $setup = Filament::getSetUpRequiredMultiFactorAuthenticationUrl();

    foreach (['/admin', '/admin/reports', '/admin/media-queue', '/admin/appeals', '/admin/verifications', '/admin/users', '/admin/tickets', '/admin/audit-log'] as $path) {
        $this->actingAs($staff, 'staff')->get($path)->assertRedirect($setup);
    }
    $this->actingAs($staff, 'staff')->get($setup)->assertOk();
});

it('laisse entrer un compte avec 2FA configurée', function () {
    $staff = Seed::staff('admin');

    $this->actingAs($staff, 'staff')->get('/admin')->assertOk();
});

it('refuse un compte désactivé, même avec une session ouverte', function () {
    $staff = Seed::staff('admin');
    $this->actingAs($staff, 'staff')->get('/admin')->assertOk();

    DB::table('staff_users')->where('id', $staff->id)->update(['is_active' => false]);

    $this->actingAs($staff->fresh(), 'staff')->get('/admin')->assertForbidden();
});

it('refuse la connexion d’un compte désactivé et celle d’un utilisateur de l’application', function () {
    $inactive = Seed::staff('admin', active: false);
    Livewire::test(StaffLogin::class)
        ->fillForm(['email' => $inactive->email, 'password' => Seed::PASSWORD])
        ->call('authenticate')
        ->assertHasFormErrors(['email']);
    $this->assertGuest('staff');

    $user = Seed::user();
    Livewire::test(StaffLogin::class)
        ->fillForm(['email' => $user->email, 'password' => 'password'])
        ->call('authenticate')
        ->assertHasFormErrors(['email']);
    $this->assertGuest('staff');
});

it('refuse un mauvais mot de passe et journalise l’échec', function () {
    $staff = Seed::staff('moderator');

    Livewire::test(StaffLogin::class)
        ->fillForm(['email' => $staff->email, 'password' => 'mauvais-mot-de-passe'])
        ->call('authenticate')
        ->assertHasFormErrors(['email']);

    $this->assertGuest('staff');
    $row = Seed::audit('staff.login_failed');
    expect($row)->not->toBeNull()->and($row->actor_staff_id)->toBe($staff->id)
        ->and(json_encode($row))->not->toContain('mauvais-mot-de-passe');
});

it('exige le second facteur : le mot de passe seul ne connecte pas, puis le code TOTP connecte et est journalisé', function () {
    $staff = Seed::staff('moderator');

    $component = Livewire::test(StaffLogin::class)
        ->fillForm(['email' => $staff->email, 'password' => Seed::PASSWORD])
        ->call('authenticate');

    $this->assertGuest('staff');
    expect(Seed::audit('staff.login'))->toBeNull();

    $code = (new Google2FA)->getCurrentOtp('JBSWY3DPEHPK3PXP');
    $component->fillForm(['multiFactor' => ['app' => ['code' => $code]]])->call('authenticate');

    $this->assertAuthenticatedAs($staff->fresh(), 'staff');
    $row = Seed::audit('staff.login');
    expect($row)->not->toBeNull()->and($row->actor_staff_id)->toBe($staff->id);
    expect($staff->fresh()->last_login_at)->not->toBeNull();
});

it('refuse un mauvais code TOTP', function () {
    $staff = Seed::staff('moderator');

    Livewire::test(StaffLogin::class)
        ->fillForm(['email' => $staff->email, 'password' => Seed::PASSWORD])
        ->call('authenticate')
        ->fillForm(['multiFactor' => ['app' => ['code' => '000000']]])
        ->call('authenticate');

    $this->assertGuest('staff');
});

it('stocke le secret TOTP chiffré et ne l’expose jamais', function () {
    $staff = Seed::staff('admin');

    $raw = DB::table('staff_users')->where('id', $staff->id)->value('totp_secret_encrypted');
    expect($raw)->not->toBe('JBSWY3DPEHPK3PXP')->and($raw)->not->toContain('JBSWY3DPEHPK3PXP');
    expect($staff->fresh()->totp_secret_encrypted)->toBe('JBSWY3DPEHPK3PXP');
    expect($staff->fresh()->toArray())->not->toHaveKeys(['password', 'totp_secret_encrypted', 'recovery_codes_encrypted']);
});

it('journalise l’activation de la 2FA', function () {
    $staff = Seed::staff('admin', twoFactor: false);

    $this->actingAs($staff, 'staff');
    $staff->saveAppAuthenticationSecret('KRSXG5CTMVRXEZLU');

    $row = Seed::audit('staff.2fa_enabled');
    expect($row)->not->toBeNull()->and($row->actor_staff_id)->toBe($staff->id)
        ->and(json_encode($row))->not->toContain('KRSXG5CTMVRXEZLU');
});

it('ne reconnaît pas un utilisateur de l’application comme membre du personnel', function () {
    $user = Seed::user();

    expect(StaffUser::where('email', $user->email)->exists())->toBeFalse();
    expect(config('auth.guards.staff.provider'))->toBe('staff')
        ->and(config('auth.providers.staff.model'))->toBe(StaffUser::class);
});
