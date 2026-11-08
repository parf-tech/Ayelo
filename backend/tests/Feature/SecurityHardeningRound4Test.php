<?php

/*
 | Non-régression du lot 4 de la seconde revue (docs/reviews/code-security-2.md) : verrouillage distribué de la connexion (N-06),
 | valeurs par défaut (F-17), minimisation des données du panneau (N-09), traces et ordre de suppression du selfie (N-13),
 | durées de conservation du texte libre (F-06).
 */

use App\Filament\Models\MediaItem;
use App\Filament\Models\Member;
use App\Filament\Resources\MediaItemResource\Pages\ListMediaItems;
use App\Filament\Resources\MemberResource;
use App\Filament\Resources\MemberResource\Pages\ViewMember;
use App\Filament\Resources\MemberResource\RelationManagers\RiskEventsRelationManager;
use App\Models\User;
use App\Services\AccountDeletion;
use App\Services\Admin\MediaModeration;
use App\Services\Admin\Permissions;
use App\Services\Admin\VerificationReview;
use App\Services\Storage\MediaStorage;
use Filament\Facades\Filament;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Livewire\Livewire;
use Tests\Feature\Admin\Support\Seed;
use Tests\Support\FakeMediaStorage;

function r4_member(array $user = []): User
{
    $u = User::factory()->create(array_merge(['birthdate' => '1993-04-05', 'password' => 'Motdepasse2026'], $user));
    DB::table('profiles')->insert(['id' => (string) Str::uuid(), 'user_id' => $u->id, 'display_name' => 'R'.substr($u->id, 0, 6), 'gender' => 'woman',
        'origin_country' => 'CM', 'residence_country' => 'FR', 'intent' => 'flirt', 'created_at' => now(), 'updated_at' => now()]);

    return $u;
}

function r4_login(string $email, string $password, string $ip, ?string $device = null)
{
    app('auth')->forgetGuards();

    return test()->withHeader('Authorization', '')->withHeader('X-Device-Id', $device ?? (string) Str::uuid())
        ->withServerVariables(['REMOTE_ADDR' => $ip])
        ->postJson('/api/v1/auth/login', ['email' => $email, 'password' => $password, 'platform' => 'ios']);
}

/** Remplit le compteur d'e-mail comme le ferait un bourrage d'identifiants venu de nombreuses IP et appareils. */
function r4_flood(string $email, int $n = 35): void
{
    foreach (range(1, $n) as $i) {
        r4_login($email, 'MauvaisMotDePasse1', '10.4.'.intdiv($i, 250).'.'.($i % 250 + 1));
    }
}

// ---------- N-06 (reste) : verrouillage distribué ----------

it('N-06 : un appareil déjà connecté avec succès reste connectable quand le compteur d’e-mail est saturé depuis beaucoup d’IP', function () {
    $u = r4_member();
    $trusted = (string) Str::uuid();
    r4_login($u->email, 'Motdepasse2026', '198.51.100.1', $trusted)->assertOk();

    r4_flood($u->email);

    // Un appareil inconnu (même avec le bon mot de passe) est arrêté : c'est le compteur partagé qui parle.
    r4_login($u->email, 'Motdepasse2026', '198.51.100.9')->assertStatus(429);
    // Le propriétaire, depuis son appareil de confiance (même après changement d'IP), se connecte.
    r4_login($u->email, 'Motdepasse2026', '203.0.113.77', $trusted)->assertOk();
});

it('N-06 : la confiance est liée au couple e-mail + appareil, et un appareil de confiance a son propre plafond', function () {
    $u = r4_member();
    $other = r4_member();
    $trusted = (string) Str::uuid();
    r4_login($u->email, 'Motdepasse2026', '198.51.100.1', $trusted)->assertOk();
    r4_flood($other->email);

    // Le même appareil n'est pas « de confiance » pour un autre compte.
    r4_login($other->email, 'Motdepasse2026', '198.51.100.2', $trusted)->assertStatus(429);

    // Sur l'appareil de confiance, 10 échecs par 15 minutes au plus : ensuite même le bon mot de passe est refusé.
    foreach (range(1, 10) as $i) {
        r4_login($u->email, 'MauvaisMotDePasse1', '203.0.113.5', $trusted)->assertUnauthorized();
    }
    r4_login($u->email, 'Motdepasse2026', '203.0.113.5', $trusted)->assertStatus(429);
});

it('N-06 : la confiance expire au bout de 30 jours', function () {
    $u = r4_member();
    $trusted = (string) Str::uuid();
    r4_login($u->email, 'Motdepasse2026', '198.51.100.1', $trusted)->assertOk();
    $this->travel(31)->days();

    r4_flood($u->email);
    r4_login($u->email, 'Motdepasse2026', '203.0.113.77', $trusted)->assertStatus(429);
});

it('N-06 : le compteur est incrémenté avant la comparaison du mot de passe (une rafale parallèle ne passe pas toute le contrôle)', function () {
    $u = r4_member();
    $ip = '203.0.113.7';
    $seen = [];

    Hash::partialMock()->shouldReceive('check')->once()->andReturnUsing(function () use ($u, $ip, &$seen) {
        $seen = [
            'pair' => RateLimiter::attempts('login-fail:'.$u->email.'|'.$ip),
            'email' => RateLimiter::attempts('login-fail-email:'.$u->email),
        ];

        return false;
    });

    r4_login($u->email, 'MauvaisMotDePasse1', $ip)->assertUnauthorized();

    expect($seen)->toBe(['pair' => 1, 'email' => 1]);
});

it('N-06 : une connexion réussie ne consomme ni le compteur d’IP ni celui d’e-mail', function () {
    $u = r4_member();
    foreach (range(1, 4) as $i) {
        r4_login($u->email, 'MauvaisMotDePasse1', '192.0.2.10')->assertUnauthorized();
    }
    r4_login($u->email, 'Motdepasse2026', '192.0.2.10')->assertOk();

    expect(RateLimiter::attempts('login-fail:'.$u->email.'|192.0.2.10'))->toBe(0)->and(RateLimiter::attempts('login-fail-email:'.$u->email))->toBe(4);
});

// ---------- F-17 : valeurs par défaut ----------

/** Charge un fichier de configuration avec un environnement donné (null = variable absente), puis restaure l'environnement. */
function r4_config(string $file, array $env): array
{
    $before = [];
    foreach ($env as $k => $v) {
        $before[$k] = [getenv($k), $_ENV[$k] ?? null, $_SERVER[$k] ?? null];
        if ($v === null) {
            putenv($k);
            unset($_ENV[$k], $_SERVER[$k]);
        } else {
            putenv("$k=$v");
            $_ENV[$k] = $_SERVER[$k] = $v;
        }
    }
    try {
        return require config_path($file);
    } finally {
        foreach ($before as $k => [$g, $e, $s]) {
            $g === false ? putenv($k) : putenv("$k=$g");
            if ($e === null) {
                unset($_ENV[$k]);
            } else {
                $_ENV[$k] = $e;
            }
            if ($s === null) {
                unset($_SERVER[$k]);
            } else {
                $_SERVER[$k] = $s;
            }
        }
    }
}

it('F-17 : les origines WebSocket viennent de REVERB_ALLOWED_ORIGINS, sinon de l’hôte du site web (jamais « * »)', function () {
    $origins = fn (array $env) => r4_config('reverb.php', $env)['apps']['apps'][0]['allowed_origins'];

    expect($origins(['REVERB_ALLOWED_ORIGINS' => 'a.example.test, *.b.example.test']))->toBe(['a.example.test', '*.b.example.test']);
    expect($origins(['REVERB_ALLOWED_ORIGINS' => null, 'APP_WEB_URL' => 'https://www.round4.test/app', 'REVERB_HOST' => 'ws.round4.test']))
        ->toBe(['www.round4.test', 'ws.round4.test']);
    expect($origins(['REVERB_ALLOWED_ORIGINS' => null, 'APP_WEB_URL' => null, 'APP_URL' => 'https://api.round4.test', 'REVERB_HOST' => null]))
        ->toBe(['api.round4.test']);

    expect(config('reverb.apps.apps.0.allowed_origins'))->not->toContain('*');
});

it('F-17 : le hachage par défaut est argon2id', function () {
    expect(r4_config('hashing.php', ['HASH_DRIVER' => null])['driver'])->toBe('argon2id');
    expect(file_get_contents(base_path('../infra/.env.prod.example')))->toContain('REVERB_ALLOWED_ORIGINS=');
});

// ---------- N-09 (reste) : minimisation pour le support, droit selfie, journal des aperçus ----------

it('N-09 : le support ne voit ni le téléphone ni le score de risque, l’administrateur oui', function () {
    Filament::setCurrentPanel('admin');
    $u = Seed::user('Awa', 'active', ['phone' => '+33612345678', 'risk_score' => 73]);
    DB::table('risk_events')->insert(['id' => (string) Str::uuid(), 'user_id' => $u->id, 'signal' => 'device_shared', 'weight' => 5, 'created_at' => now()]);

    $this->flushSession();
    $this->actingAs(Seed::staff('support'), 'staff')->get("/admin/users/{$u->id}")
        ->assertOk()->assertSee('Awa')->assertSee($u->email)->assertDontSee('+33612345678')->assertDontSee('Score de risque');
    $this->flushSession();
    $this->actingAs(Seed::staff('support'), 'staff')->get('/admin/users')->assertOk()->assertDontSee('+33612345678');

    // Les colonnes ne sont même pas chargées pour le support (pas seulement masquées par l'interface).
    $this->actingAs(Seed::staff('support'), 'staff');
    expect(MemberResource::getEloquentQuery()->whereKey($u->id)->first()->getAttributes())->not->toHaveKey('phone')->not->toHaveKey('risk_score');
    expect(RiskEventsRelationManager::canViewForRecord(Member::find($u->id), ViewMember::class))->toBeFalse();

    $this->flushSession();
    $this->actingAs(Seed::staff('admin'), 'staff')->get("/admin/users/{$u->id}")
        ->assertOk()->assertSee('+33612345678')->assertSee('Score de risque');
    expect(MemberResource::getEloquentQuery()->whereKey($u->id)->first()->risk_score)->toBe(73);
    expect(RiskEventsRelationManager::canViewForRecord(Member::find($u->id), ViewMember::class))->toBeTrue();
});

it('N-09 : le droit « selfie » est contrôlé par le service (le support est refusé et rien n’est journalisé)', function () {
    $storage = new FakeMediaStorage;
    app()->instance(MediaStorage::class, $storage);
    [$req] = Seed::verification(Seed::user()->id);
    $support = Seed::staff('support');
    $mod = Seed::staff('moderator');
    $svc = app(VerificationReview::class);

    expect(Permissions::can($support, Permissions::SELFIE_VIEW))->toBeFalse()->and(Permissions::can($mod, Permissions::SELFIE_VIEW))->toBeTrue();
    expect(fn () => $svc->viewSelfie($support, $req))->toThrow(AuthorizationException::class);
    expect(Seed::auditCount('verification.selfie_viewed'))->toBe(0);

    expect($svc->viewSelfie($mod, $req))->toContain('selfie.jpg');
    expect(Seed::auditCount('verification.selfie_viewed'))->toBe(1);
});

it('N-09 : l’aperçu d’un média de la file écrit « media.preview » (sans l’URL), et le service refuse support et selfie', function () {
    Filament::setCurrentPanel('admin');
    $storage = new FakeMediaStorage;
    app()->instance(MediaStorage::class, $storage);
    $u = Seed::user();
    $m = Seed::media($u->id, 'message_image', 'processing', 'u/x/img.jpg');
    $mod = Seed::staff('moderator');
    $svc = app(MediaModeration::class);

    expect(fn () => $svc->preview(Seed::staff('support'), $m))->toThrow(AuthorizationException::class);
    expect(Seed::auditCount('media.preview'))->toBe(0);

    $url = $svc->preview($mod, $m);
    expect($url)->toBe('https://storage.test/get/u/x/img.jpg?ttl=10');
    $audit = Seed::audit('media.preview');
    expect($audit->actor_staff_id)->toBe($mod->id)->and($audit->subject_id)->toBe($m)
        ->and(json_decode($audit->after, true))->toMatchArray(['user_id' => $u->id, 'kind' => 'message_image'])
        ->and(json_encode($audit))->not->toContain('storage.test')->and(json_encode($audit))->not->toContain('img.jpg');

    // Un selfie de vérification ne sort jamais par ce chemin.
    [, $selfie] = Seed::verification(Seed::user('Vera')->id);
    expect(fn () => $svc->preview($mod, $selfie))->toThrow(DomainException::class);
    expect(Seed::auditCount('media.preview'))->toBe(1);

    // Dans l'interface : le clic écrit la ligne avant de remettre le lien.
    $this->actingAs($mod, 'staff');
    Livewire::test(ListMediaItems::class)->callTableAction('preview', MediaItem::find($m))->assertNotified('Aperçu journalisé.');
    expect(Seed::auditCount('media.preview'))->toBe(2);
});

// ---------- N-13 (reste) : selfie supprimé après validation ; ouverture obligatoire avant d'approuver ----------

it('N-13 : une validation qui échoue après la décision ne fait pas perdre le selfie', function () {
    $storage = new FakeMediaStorage;
    app()->instance(MediaStorage::class, $storage);
    $u = Seed::user();
    [$req, $media] = Seed::verification($u->id);
    $storage->simulateUpload("u/{$u->id}/selfie.jpg", 10, 'image/jpeg');
    $mod = Seed::staff('moderator');
    $svc = app(VerificationReview::class);
    $svc->viewSelfie($mod, $req);

    // Transaction externe qui échoue après l'approbation (équivalent d'un commit refusé) : tout est annulé.
    try {
        DB::transaction(function () use ($svc, $mod, $req) {
            $svc->approve($mod, $req);
            throw new RuntimeException('commit refusé');
        });
    } catch (RuntimeException) {
    }

    expect($storage->deleted)->toBe([])->and($storage->head("u/{$u->id}/selfie.jpg"))->not->toBeNull();
    expect(DB::table('verification_requests')->find($req)->status)->toBe('pending')->and(DB::table('media')->find($media)->status)->toBe('processing');

    // Une fois la transaction validée, l'objet est supprimé.
    DB::transaction(fn () => $svc->approve($mod, $req));
    expect($storage->deleted)->toBe(["u/{$u->id}/selfie.jpg"])->and(DB::table('media')->find($media)->status)->toBe('purged');
});

it('N-13 : une panne du stockage après la décision est signalée, la décision tient, et media:purge-pending reprend la suppression', function () {
    $storage = new class extends FakeMediaStorage
    {
        public bool $down = true;

        public function delete(string $key): void
        {
            if ($this->down) {
                throw new RuntimeException('stockage indisponible');
            }
            parent::delete($key);
        }
    };
    app()->instance(MediaStorage::class, $storage);
    $u = Seed::user();
    [$req, $media] = Seed::verification($u->id);
    $storage->simulateUpload("u/{$u->id}/selfie.jpg", 10, 'image/jpeg');
    $mod = Seed::staff('moderator');
    $svc = app(VerificationReview::class);
    $svc->viewSelfie($mod, $req);

    $svc->approve($mod, $req);

    expect(DB::table('verification_requests')->find($req)->status)->toBe('approved')->and(DB::table('media')->find($media)->purge_after)->not->toBeNull();
    expect($storage->head("u/{$u->id}/selfie.jpg"))->not->toBeNull();

    $storage->down = false;
    $this->artisan('media:purge-pending')->assertSuccessful();
    expect($storage->head("u/{$u->id}/selfie.jpg"))->toBeNull()->and(DB::table('media')->find($media)->purge_after)->toBeNull();
});

it('N-13 : approuver exige d’avoir ouvert le selfie soi-même (ouverture par un autre, ou rejet, ne comptent pas)', function () {
    $storage = new FakeMediaStorage;
    app()->instance(MediaStorage::class, $storage);
    $u = Seed::user();
    [$req, $media] = Seed::verification($u->id);
    $storage->simulateUpload("u/{$u->id}/selfie.jpg", 10, 'image/jpeg');
    $mod = Seed::staff('moderator');
    $other = Seed::staff('moderator');
    $svc = app(VerificationReview::class);

    // Sans ouverture : refus, rien ne change, rien n'est supprimé, aucune ligne « approved ».
    expect(fn () => $svc->approve($mod, $req))->toThrow(DomainException::class, 'Ouvrez le selfie');
    expect(DB::table('verification_requests')->find($req)->status)->toBe('pending')->and($storage->deleted)->toBe([])->and(Seed::auditCount('verification.approved'))->toBe(0);

    // Ouvert par un autre membre du personnel : insuffisant.
    $svc->viewSelfie($other, $req);
    expect(fn () => $svc->approve($mod, $req))->toThrow(DomainException::class, 'Ouvrez le selfie');

    // Ouvert pour une AUTRE demande : insuffisant aussi.
    [$req2] = Seed::verification(Seed::user('Vera')->id);
    $svc->viewSelfie($mod, $req2);
    expect(fn () => $svc->approve($mod, $req))->toThrow(DomainException::class, 'Ouvrez le selfie');

    // Ouvert par l'approbateur pour cette demande : accepté.
    $svc->viewSelfie($mod, $req);
    $svc->approve($mod, $req);
    expect(DB::table('verification_requests')->find($req)->status)->toBe('approved')->and(Seed::auditCount('verification.approved'))->toBe(1);
});

it('N-13 : le rejet n’exige pas l’ouverture du selfie', function () {
    app()->instance(MediaStorage::class, new FakeMediaStorage);
    [$req] = Seed::verification(Seed::user()->id);

    app(VerificationReview::class)->reject(Seed::staff('moderator'), $req, 'Pose non conforme');

    expect(DB::table('verification_requests')->find($req)->status)->toBe('rejected');
});

// ---------- F-06 (reste) : durées de conservation du texte libre ----------

it('F-06 : reports.details et sanctions.reason sont effacés après la durée de conservation, une fois un compte anonymisé', function () {
    expect(config('retention.report_details_days'))->toBe(365);
    config(['retention.report_details_days' => 30, 'retention.sanction_reason_days' => 30]);

    $gone = Seed::user('Gone', 'deleted');
    $alive = Seed::user('Alive');
    $reporter = Seed::user('Rep');
    $old = now()->subDays(40);

    $mk = function (string $reported, ?string $reporterId, DateTimeInterface $at, ?string $retainUntil = null) {
        $id = Seed::report($reported, 'harassment', 0, $reporterId, $at);
        DB::table('reports')->where('id', $id)->update(['details' => 'texte libre '.$id, 'evidence_retain_until' => $retainUntil]);

        return $id;
    };
    $purged = $mk($gone->id, $reporter->id, $old);
    $purgedViaReporter = $mk($alive->id, $gone->id, $old);
    $recent = $mk($gone->id, $reporter->id, now()->subDays(5));
    $underHold = $mk($gone->id, $reporter->id, $old, now()->addMonth()->toDateTimeString());
    $bothAlive = $mk($alive->id, $reporter->id, $old);

    $s1 = Seed::sanction($gone->id, 'ban', null, 'motif libre ancien');
    DB::table('sanctions')->where('id', $s1)->update(['created_at' => $old]);
    $s2 = Seed::sanction($gone->id, 'warning', null, 'motif libre récent');
    DB::table('sanctions')->where('id', $s2)->update(['created_at' => now()->subDays(5)]);
    $s3 = Seed::sanction($alive->id, 'warning', null, 'motif libre compte actif');
    DB::table('sanctions')->where('id', $s3)->update(['created_at' => $old]);

    $result = app(AccountDeletion::class)->purgeRetainedText();

    expect($result)->toBe(['reports' => 2, 'sanctions' => 1]);
    foreach ([$purged, $purgedViaReporter] as $id) {
        expect(DB::table('reports')->find($id)->details)->toBeNull();
    }
    foreach ([$recent, $underHold, $bothAlive] as $id) {
        expect(DB::table('reports')->find($id)->details)->toBe('texte libre '.$id);
    }
    expect(DB::table('sanctions')->find($s1)->reason)->toBe(AccountDeletion::PURGED_REASON)
        ->and(DB::table('sanctions')->find($s2)->reason)->toBe('motif libre récent')
        ->and(DB::table('sanctions')->find($s3)->reason)->toBe('motif libre compte actif');

    // Idempotent, et exécuté par la purge quotidienne des comptes.
    expect(app(AccountDeletion::class)->purgeRetainedText())->toBe(['reports' => 0, 'sanctions' => 0]);
});

it('F-06 : la purge quotidienne des comptes applique aussi les durées de conservation', function () {
    config(['retention.report_details_days' => 30]);
    $gone = Seed::user('Gone', 'deleted');
    $id = Seed::report($gone->id, 'harassment', 0, null, now()->subDays(40));
    DB::table('reports')->where('id', $id)->update(['details' => 'texte libre']);

    $this->artisan('accounts:purge')->assertSuccessful();

    expect(DB::table('reports')->find($id)->details)->toBeNull();
});
