<?php

use App\Models\StaffUser;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Tests\Feature\Admin\Support\Seed;

it('crée un compte avec un mot de passe généré, affiché une seule fois et stocké haché', function () {
    Log::spy();

    $this->artisan('staff:create', ['email' => 'Premier.Admin@Ayelo.test', 'role' => 'admin'])->expectsOutputToContain('rôle admin')->assertSuccessful();

    $staff = StaffUser::where('email', 'premier.admin@ayelo.test')->first();
    expect($staff)->not->toBeNull()->and($staff->role)->toBe('admin')->and($staff->is_active)->toBeTrue()->and($staff->totp_secret_encrypted)->not->toBeNull();
    expect(Hash::isHashed($staff->password))->toBeTrue();
    expect(DB::table('staff_users')->where('id', $staff->id)->value('password'))->not->toContain('Premier');
});

it('affiche le mot de passe généré, qui permet de se connecter, et ne l’écrit nulle part ailleurs', function () {
    Log::spy();
    $output = new Symfony\Component\Console\Output\BufferedOutput;
    Artisan::call('staff:create', ['email' => 'mod@ayelo.test', 'role' => 'moderator'], $output);
    $text = $output->fetch();

    $staff = StaffUser::where('email', 'mod@ayelo.test')->first();
    preg_match('/(?<![A-Za-z0-9])([A-Za-z0-9]{20})(?![A-Za-z0-9])/', $text, $m);
    expect($m)->toHaveCount(2);
    expect(Hash::check($m[1], $staff->password))->toBeTrue();
    expect(substr_count($text, $m[1]))->toBe(1);

    expect(json_encode(DB::table('audit_logs')->get()))->not->toContain($m[1]);
    Log::shouldNotHaveReceived('info');
    $audit = Seed::audit('staff.created');
    expect($audit->actor_staff_id)->toBeNull()->and($audit->subject_id)->toBe($staff->id)->and(json_decode($audit->after, true))->toEqual(['email' => 'mod@ayelo.test', 'role' => 'moderator']);
});

it('génère un mot de passe différent à chaque appel', function () {
    $passwords = [];
    foreach (['a@ayelo.test', 'b@ayelo.test'] as $email) {
        $output = new Symfony\Component\Console\Output\BufferedOutput;
        Artisan::call('staff:create', ['email' => $email, 'role' => 'support'], $output);
        preg_match('/(?<![A-Za-z0-9])([A-Za-z0-9]{20})(?![A-Za-z0-9])/', $output->fetch(), $m);
        $passwords[] = $m[1];
    }

    expect($passwords[0])->not->toBe($passwords[1]);
});

it('permet de saisir le mot de passe en masqué (--prompt) sans l’afficher', function () {
    $this->artisan('staff:create', ['email' => 'saisi@ayelo.test', 'role' => 'support', '--prompt' => true])
        ->expectsQuestion('Mot de passe (12 caractères minimum)', 'un-mot-de-passe-long-1')
        ->assertSuccessful()->doesntExpectOutputToContain('un-mot-de-passe-long-1');

    expect(Hash::check('un-mot-de-passe-long-1', StaffUser::where('email', 'saisi@ayelo.test')->value('password')))->toBeTrue();
});

it('refuse un rôle inconnu, un e-mail invalide et un doublon', function () {
    $this->artisan('staff:create', ['email' => 'x@ayelo.test', 'role' => 'root'])->assertFailed();
    $this->artisan('staff:create', ['email' => 'pas-un-email', 'role' => 'admin'])->assertFailed();
    $this->artisan('staff:create', ['email' => 'dup@ayelo.test', 'role' => 'admin'])->assertSuccessful();
    $this->artisan('staff:create', ['email' => 'DUP@ayelo.test', 'role' => 'support'])->assertFailed();

    expect(StaffUser::count())->toBe(1);
});

it('efface la 2FA d’un compte et le journalise', function () {
    $staff = Seed::staff('moderator');

    $this->artisan('staff:reset-2fa', ['email' => $staff->email])->assertSuccessful();

    expect($staff->fresh()->hasTwoFactor())->toBeFalse();
    expect(Seed::audit('staff.2fa_disabled'))->not->toBeNull();
    $this->artisan('staff:reset-2fa', ['email' => 'inconnu@ayelo.test'])->assertFailed();
});

it('réactive les comptes dont la suspension a expiré, pas les autres', function () {
    $expired = Seed::user('Expire', 'suspended');
    Seed::sanction($expired->id, 'suspension', now()->subHour());
    $running = Seed::user('EnCours', 'suspended');
    Seed::sanction($running->id, 'suspension', now()->addDay());
    $banned = Seed::user('Banni', 'banned');
    Seed::sanction($banned->id, 'ban', null);

    $this->artisan('sanctions:expire')->expectsOutputToContain('1 compte(s) réactivé(s)')->assertSuccessful();

    expect(DB::table('users')->find($expired->id)->status)->toBe('active')
        ->and(DB::table('users')->find($running->id)->status)->toBe('suspended')
        ->and(DB::table('users')->find($banned->id)->status)->toBe('banned');
    expect(Seed::audit('sanction.expired'))->not->toBeNull(); // N-13 : la réactivation automatique est tracée
});
