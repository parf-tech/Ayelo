<?php

/*
 | Non-régression du lot 9 (console du personnel), résidus N-09, N-10 et N-13 de docs/reviews/code-security-2-suivi.md :
 | séparation « vérifier / voir le selfie » par rôle (invariant de la matrice), mot de passe initial jamais passé en argument,
 | opérateur obligatoire en production pour staff:create et staff:reset-2fa.
 */

use App\Models\StaffUser;
use App\Services\Admin\Permissions;
use App\Services\Admin\VerificationReview;
use App\Services\Storage\MediaStorage;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Console\Output\BufferedOutput;
use Tests\Feature\Admin\Support\Seed;
use Tests\Support\FakeMediaStorage;

function r9_production(): void
{
    app()->detectEnvironment(fn () => 'production');
}

// ---------- N-09 : séparation verifications.review / verifications.selfie ----------

it('N-09 : la matrice réelle respecte l’invariant (décision explicite sur le selfie pour chaque rôle qui vérifie)', function () {
    expect(Permissions::violations())->toBe([]);

    foreach (StaffUser::ROLES as $role) {
        $abilities = Permissions::for($role);
        $reviews = in_array(Permissions::VERIFICATIONS_REVIEW, $abilities, true);
        $selfie = in_array(Permissions::SELFIE_VIEW, $abilities, true);
        if ($reviews) {
            expect(Permissions::SELFIE_POLICY)->toHaveKey($role);
            expect(Permissions::SELFIE_POLICY[$role] === Permissions::SELFIE_OPENS)->toBe($selfie);
        } else {
            expect($selfie)->toBeFalse(); // le selfie n'est jamais ouvert par un rôle qui ne vérifie pas
        }
    }
    expect(Permissions::can(Seed::staff('support'), Permissions::VERIFICATIONS_REVIEW))->toBeFalse(); // appel de can() : invariants vérifiés sans exception
});

it('N-09 : l’invariant détecte une matrice sans décision, contredite, ou avec un selfie orphelin', function () {
    $review = Permissions::VERIFICATIONS_REVIEW;
    $selfie = Permissions::SELFIE_VIEW;

    expect(Permissions::violations(['moderator' => [$review, $selfie]], []))->toHaveCount(1)->and(Permissions::violations(['moderator' => [$review, $selfie]], [])[0])->toContain('sans décision explicite');
    expect(Permissions::violations(['moderator' => [$review]], ['moderator' => Permissions::SELFIE_OPENS]))->toHaveCount(1);
    expect(Permissions::violations(['moderator' => [$review, $selfie]], ['moderator' => Permissions::REJECT_ONLY]))->toHaveCount(1);
    expect(Permissions::violations(['support' => [$selfie]], []))->toHaveCount(1);
    expect(Permissions::violations(['moderator' => [$review]], ['moderator' => Permissions::REJECT_ONLY]))->toBe([]); // décision documentée : rejet seul
    expect(Permissions::violations(['moderator' => [$review]], ['ghost' => Permissions::REJECT_ONLY]))->toHaveCount(2);
});

it('N-09 : VerificationReview applique la séparation pour chaque rôle (admin, moderator, support)', function () {
    $storage = new FakeMediaStorage;
    app()->instance(MediaStorage::class, $storage);
    $svc = app(VerificationReview::class);

    foreach (['admin', 'moderator'] as $role) {
        $actor = Seed::staff($role);
        $user = Seed::user($role);
        [$req] = Seed::verification($user->id);
        $storage->simulateUpload("u/{$user->id}/selfie.jpg", 10, 'image/jpeg');

        // Sans ouverture du selfie : approuver refusé (le rejet reste possible), puis ouverture journalisée, puis approbation.
        expect(fn () => $svc->approve($actor, $req))->toThrow(DomainException::class, 'Ouvrez le selfie');
        expect($svc->viewSelfie($actor, $req))->toContain('selfie.jpg');
        expect(Seed::auditCount('verification.selfie_viewed'))->toBeGreaterThan(0);
        $svc->approve($actor, $req);
        expect(DB::table('verification_requests')->find($req)->status)->toBe('approved');

        [$req2] = Seed::verification(Seed::user($role.'2')->id);
        $svc->reject($actor, $req2, 'photo floue');
        expect(DB::table('verification_requests')->find($req2)->status)->toBe('rejected');
    }

    // Support : aucun droit de vérification ni de selfie, rien n'est modifié ni journalisé.
    $support = Seed::staff('support');
    [$req] = Seed::verification(Seed::user('Soutien')->id);
    $before = DB::table('audit_logs')->count();
    $denied = AuthorizationException::class;
    expect(fn () => $svc->viewSelfie($support, $req))->toThrow($denied);
    expect(fn () => $svc->approve($support, $req))->toThrow($denied);
    expect(fn () => $svc->reject($support, $req, 'non'))->toThrow($denied);
    expect(DB::table('verification_requests')->find($req)->status)->toBe('pending')->and(DB::table('audit_logs')->count())->toBe($before);
});

// ---------- N-10 : le mot de passe initial ne passe jamais en argument ----------

it('N-10 : staff:create n’accepte ni argument ni option « mot de passe » (historique du shell)', function () {
    $definition = Artisan::all()['staff:create']->getDefinition();

    expect(array_keys($definition->getArguments()))->toBe(['email', 'role']);
    expect(array_keys($definition->getOptions()))->not->toContain('password');
    expect($definition->hasOption('prompt'))->toBeTrue()->and($definition->hasOption('show-secret'))->toBeTrue();
});

it('N-10 : le mot de passe est généré (20 caractères alphanumériques, fort), affiché une seule fois, sans le secret 2FA', function () {
    $out = new BufferedOutput;
    Artisan::call('staff:create', ['email' => 'fort@ayelo.test', 'role' => 'support'], $out);
    $text = $out->fetch();
    $staff = StaffUser::where('email', 'fort@ayelo.test')->first();

    preg_match_all('/(?<![A-Za-z0-9])([A-Za-z0-9]{20})(?![A-Za-z0-9])/', $text, $m);
    expect($m[1])->toHaveCount(1)->and(Hash::check($m[1][0], $staff->password))->toBeTrue();
    expect($text)->not->toContain($staff->totp_secret_encrypted); // le secret 2FA n'est affiché qu'avec --show-secret
    expect(json_encode(DB::table('audit_logs')->get()))->not->toContain($m[1][0]);
});

// ---------- N-13 : opérateur obligatoire en production ----------

it('N-13 : en production, staff:create refuse sans STAFF_OPERATOR (message clair, code non nul, aucun compte)', function () {
    r9_production();
    config(['app.staff_operator' => '']);

    $out = new BufferedOutput;
    $code = Artisan::call('staff:create', ['email' => 'prod@ayelo.test', 'role' => 'admin'], $out);

    expect($code)->not->toBe(0)->and($out->fetch())->toContain('STAFF_OPERATOR est vide');
    expect(StaffUser::count())->toBe(0)->and(Seed::auditCount('staff.created'))->toBe(0);

    config(['app.staff_operator' => '   ']); // des espaces ne comptent pas comme un opérateur
    expect(Artisan::call('staff:create', ['email' => 'prod@ayelo.test', 'role' => 'admin']))->not->toBe(0);
});

it('N-13 : en production, staff:reset-2fa refuse sans STAFF_OPERATOR et laisse la 2FA intacte', function () {
    $staff = Seed::staff('moderator');
    $old = $staff->totp_secret_encrypted;
    r9_production();
    config(['app.staff_operator' => null]);

    $out = new BufferedOutput;
    $code = Artisan::call('staff:reset-2fa', ['email' => $staff->email], $out);

    expect($code)->not->toBe(0)->and($out->fetch())->toContain('STAFF_OPERATOR est vide');
    expect($staff->fresh()->totp_secret_encrypted)->toBe($old)->and(Seed::auditCount('staff.2fa_reset'))->toBe(0);
});

it('N-13 : en production avec STAFF_OPERATOR, l’opérateur et le hostname sont enregistrés', function () {
    r9_production();
    config(['app.staff_operator' => 'alice@ops']);

    expect(Artisan::call('staff:create', ['email' => 'prod@ayelo.test', 'role' => 'admin']))->toBe(0);
    expect(json_decode(Seed::audit('staff.created')->after, true))->toMatchArray(['operator' => 'alice@ops', 'host' => gethostname()]);

    expect(Artisan::call('staff:reset-2fa', ['email' => 'prod@ayelo.test']))->toBe(0);
    expect(json_decode(Seed::audit('staff.2fa_reset')->after, true))->toEqual(['operator' => 'alice@ops', 'host' => gethostname()]);
});

it('N-13 : hors production, un STAFF_OPERATOR vide reste accepté (comportement inchangé, aucune clé inventée)', function () {
    expect(app()->isProduction())->toBeFalse();
    config(['app.staff_operator' => '']);

    expect(Artisan::call('staff:create', ['email' => 'dev@ayelo.test', 'role' => 'support']))->toBe(0);
    expect(json_decode(Seed::audit('staff.created')->after, true))->toEqual(['email' => 'dev@ayelo.test', 'role' => 'support']);
    expect(Artisan::call('staff:reset-2fa', ['email' => 'dev@ayelo.test']))->toBe(0);
    expect(Seed::audit('staff.2fa_reset')->after)->toBeNull();
});
