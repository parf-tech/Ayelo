<?php

use App\Events\BillingUpdated;
use App\Logging\RedactLogs;
use App\Logging\RedactSensitiveData;
use App\Models\StaffUser;
use App\Models\User;
use App\Services\OAuth\JwtOAuthVerifier;
use App\Services\Premium;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\DemoDataSeeder;
use Firebase\JWT\JWK;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\Job as QueueJob;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\Events\JobFailed;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Monolog\Level;
use Monolog\LogRecord;

/**
 * Checklist `replica/backend.md` : jeu de données fictif, durcissement RevenueCat (revue F-13), dead-letter des tâches,
 * masquage des journaux, vérification des vrais JWKS (facultative : RUN_NETWORK_TESTS=1).
 */

// ---------------------------------------------------------------------------------------------------------------------
// (1) Jeu de données fictif
// ---------------------------------------------------------------------------------------------------------------------

it('charge un jeu de données fictif réaliste qui respecte les contraintes du schéma', function () {
    $this->seed(DatabaseSeeder::class);

    expect(User::count())->toBe(DemoDataSeeder::MEMBER_COUNT)
        ->and(DB::table('users')->where('email', 'not like', '%@example.test')->count())->toBe(0)
        ->and(DB::table('profiles')->count())->toBe(DemoDataSeeder::MEMBER_COUNT)
        ->and(DB::table('profiles')->distinct()->count('origin_country'))->toBeGreaterThanOrEqual(8)
        ->and(DB::table('profiles')->distinct()->count('residence_country'))->toBeGreaterThanOrEqual(8)
        ->and(DB::table('profiles')->distinct()->pluck('gender')->sort()->values()->all())->toBe(['man', 'other', 'woman'])
        ->and(DB::table('profiles')->distinct()->count('intent'))->toBe(5)
        ->and(DB::table('preferences')->count())->toBe(DemoDataSeeder::MEMBER_COUNT);

    // Interactions : affinités réciproques, conversations et messages cohérents.
    expect(DB::table('matches')->count())->toBeGreaterThan(5)
        ->and(DB::table('matches')->whereRaw('user_a >= user_b')->count())->toBe(0)
        ->and(DB::table('conversations')->count())->toBeGreaterThan(3)
        ->and(DB::table('messages')->count())->toBeGreaterThan(10)
        ->and(DB::table('messages as m')->join('conversations as c', 'c.id', '=', 'm.conversation_id')
            ->whereNotIn('m.sender_id', [DB::raw('c.user_a'), DB::raw('c.user_b')])->count())->toBe(0);

    // Modération et facturation.
    expect(DB::table('reports')->count())->toBeGreaterThanOrEqual(3)
        ->and(DB::table('reports')->where('status', 'open')->count())->toBeGreaterThanOrEqual(1)
        ->and(DB::table('sanctions')->count())->toBeGreaterThanOrEqual(2)
        ->and(DB::table('users')->where('status', 'suspended')->count())->toBe(1)
        ->and(DB::table('subscriptions')->count())->toBeGreaterThanOrEqual(4);

    $premium = User::where('email', 'demo01@example.test')->firstOrFail();
    expect(Premium::active($premium->id))->toBeTrue();

    // Personnel : un compte par rôle, adresses fictives, mot de passe haché (jamais en clair).
    expect(StaffUser::pluck('role')->sort()->values()->all())->toBe(['admin', 'moderator', 'support']);
    StaffUser::all()->each(function (StaffUser $s) {
        expect($s->email)->toEndWith('@example.test')
            ->and(mb_strlen($s->getRawOriginal('password')))->toBeGreaterThan(50)
            ->and($s->getRawOriginal('password'))->toStartWith('$');
    });
    User::all()->each(fn (User $u) => expect($u->getRawOriginal('password'))->toStartWith('$'));
});

it('ne duplique rien si le jeu de données est déjà chargé', function () {
    $this->seed(DatabaseSeeder::class);
    $before = [DB::table('users')->count(), DB::table('staff_users')->count(), DB::table('messages')->count()];

    $this->seed(DatabaseSeeder::class);

    expect([DB::table('users')->count(), DB::table('staff_users')->count(), DB::table('messages')->count()])->toBe($before);
});

it('refuse de charger le jeu de données fictif en production', function (string $seeder) {
    app()['env'] = 'production';
    expect(app()->isProduction())->toBeTrue();

    // Appel direct (la commande db:seed demande elle-même une confirmation en production).
    expect(fn () => (new $seeder)->setContainer(app())())->toThrow(RuntimeException::class, 'production');
    expect(DB::table('users')->count())->toBe(0)->and(DB::table('staff_users')->count())->toBe(0);
})->with([DatabaseSeeder::class, DemoDataSeeder::class]);

// ---------------------------------------------------------------------------------------------------------------------
// (2) RevenueCat : sandbox et ordre des événements (revue F-13)
// ---------------------------------------------------------------------------------------------------------------------

const CHK_RC_SECRET = 'secret-checklist';

function chkBuyer(): User
{
    return User::factory()->create(['birthdate' => '1990-01-01']);
}

function chkRc(array $event)
{
    config(['billing.webhook_secret' => CHK_RC_SECRET]);

    return test()->withHeader('Authorization', 'Bearer '.CHK_RC_SECRET)->postJson('/api/v1/webhooks/revenuecat', ['event' => array_merge([
        'id' => (string) Str::uuid(), 'store' => 'APP_STORE',
    ], $event)]);
}

/** @return array<string, mixed> */
function chkPurchase(User $u, array $over = []): array
{
    return array_merge([
        'type' => 'INITIAL_PURCHASE', 'app_user_id' => $u->id, 'product_id' => 'premium_1m', 'original_transaction_id' => 'otx-chk',
        'transaction_id' => 'tx-chk', 'purchased_at_ms' => now()->subDay()->getTimestampMs(), 'expiration_at_ms' => now()->addMonth()->getTimestampMs(),
        'event_timestamp_ms' => 1_000_000,
    ], $over);
}

describe('RevenueCat', function () {
    beforeEach(fn () => Event::fake([BillingUpdated::class]));

    it('acquitte sans appliquer un événement SANDBOX en production', function () {
        app()['env'] = 'production';
        $u = chkBuyer();

        chkRc(chkPurchase($u, ['id' => 'evt-sandbox', 'environment' => 'SANDBOX']))->assertOk()->assertJsonPath('result', 'ignored');

        expect(DB::table('subscriptions')->count())->toBe(0)
            ->and(Premium::active($u->id))->toBeFalse();
        $row = DB::table('webhook_events')->where('id', 'evt-sandbox')->first();
        expect($row)->not->toBeNull()->and($row->processed_at)->not->toBeNull()->and($row->error)->toContain('sandbox');
        Event::assertNotDispatched(BillingUpdated::class);

        // Le réessai du même événement reste acquitté sans effet.
        chkRc(chkPurchase($u, ['id' => 'evt-sandbox', 'environment' => 'SANDBOX']))->assertOk()->assertJsonPath('result', 'duplicate');
        expect(DB::table('subscriptions')->count())->toBe(0);
    });

    it('applique un événement PRODUCTION en production', function () {
        app()['env'] = 'production';
        $u = chkBuyer();

        chkRc(chkPurchase($u, ['environment' => 'PRODUCTION']))->assertOk()->assertJsonPath('result', 'processed');

        expect(Premium::active($u->id))->toBeTrue();
    });

    it('applique un événement SANDBOX hors production (développement, tests)', function () {
        expect(app()->isProduction())->toBeFalse();
        $u = chkBuyer();

        chkRc(chkPurchase($u, ['environment' => 'SANDBOX']))->assertOk()->assertJsonPath('result', 'processed');

        expect(Premium::active($u->id))->toBeTrue();
    });

    it("ignore un événement plus ancien livré après un plus récent pour le même abonnement", function () {
        $u = chkBuyer();
        $newEnd = now()->addMonths(2)->getTimestampMs();

        // Le renouvellement (t = 2 000 000) arrive d'abord.
        chkRc(chkPurchase($u, ['type' => 'RENEWAL', 'event_timestamp_ms' => 2_000_000, 'expiration_at_ms' => $newEnd]))->assertOk()->assertJsonPath('result', 'processed');
        // Puis l'achat initial (t = 1 000 000), livré en retard : il ne doit rien écraser.
        chkRc(chkPurchase($u, ['id' => 'evt-vieux', 'event_timestamp_ms' => 1_000_000, 'expiration_at_ms' => now()->addMonth()->getTimestampMs()]))
            ->assertOk()->assertJsonPath('result', 'ignored');

        $sub = DB::table('subscriptions')->first();
        expect(DB::table('subscriptions')->count())->toBe(1)
            ->and(abs(strtotime($sub->period_end) - (int) ($newEnd / 1000)))->toBeLessThan(2)
            ->and((int) $sub->last_event_ms)->toBe(2_000_000);
        $row = DB::table('webhook_events')->where('id', 'evt-vieux')->first();
        expect($row->processed_at)->not->toBeNull()->and($row->error)->toContain('plus ancien');
    });

    it("n'annule pas un abonnement renouvelé quand une expiration plus ancienne arrive en retard", function () {
        $u = chkBuyer();
        chkRc(chkPurchase($u, ['type' => 'RENEWAL', 'event_timestamp_ms' => 5_000_000]))->assertOk();

        chkRc(['type' => 'EXPIRATION', 'app_user_id' => $u->id, 'original_transaction_id' => 'otx-chk', 'event_timestamp_ms' => 4_000_000])
            ->assertOk()->assertJsonPath('result', 'ignored');
        chkRc(['type' => 'CANCELLATION', 'app_user_id' => $u->id, 'product_id' => 'premium_1m', 'original_transaction_id' => 'otx-chk', 'event_timestamp_ms' => 3_000_000])
            ->assertOk()->assertJsonPath('result', 'ignored');
        expect(DB::table('subscriptions')->value('status'))->toBe('active')->and(Premium::active($u->id))->toBeTrue();

        // Un événement plus récent est appliqué normalement.
        chkRc(['type' => 'EXPIRATION', 'app_user_id' => $u->id, 'original_transaction_id' => 'otx-chk', 'event_timestamp_ms' => 6_000_000])
            ->assertOk()->assertJsonPath('result', 'processed');
        expect(DB::table('subscriptions')->value('status'))->toBe('expired')->and((int) DB::table('subscriptions')->value('last_event_ms'))->toBe(6_000_000);
    });

    it("garde l'idempotence : le même identifiant d'événement n'est appliqué qu'une fois", function () {
        $u = chkBuyer();
        $evt = chkPurchase($u, ['id' => 'evt-idem', 'event_timestamp_ms' => 7_000_000]);

        chkRc($evt)->assertOk()->assertJsonPath('result', 'processed');
        chkRc($evt)->assertOk()->assertJsonPath('result', 'duplicate');
        chkRc($evt)->assertOk()->assertJsonPath('result', 'duplicate');

        expect(DB::table('subscriptions')->count())->toBe(1)->and(DB::table('webhook_events')->where('id', 'evt-idem')->count())->toBe(1);
    });

    it("applique encore un événement sans horodatage (format historique)", function () {
        $u = chkBuyer();
        $evt = chkPurchase($u);
        unset($evt['event_timestamp_ms']);

        chkRc($evt)->assertOk()->assertJsonPath('result', 'processed');

        expect(Premium::active($u->id))->toBeTrue()->and(DB::table('subscriptions')->value('last_event_ms'))->toBeNull();
    });
});

// ---------------------------------------------------------------------------------------------------------------------
// (3) Dead-letter des tâches échouées
// ---------------------------------------------------------------------------------------------------------------------

class ChecklistFailingJob implements ShouldQueue
{
    use Dispatchable, Queueable;

    public function __construct(public string $payload = 'claire@example.test') {}

    public function handle(): void
    {
        throw new LogicException('échec avec donnée personnelle claire@example.test');
    }
}

it('dispose de la table failed_jobs et planifie sa purge à 168 heures', function () {
    expect(Schema::hasTable('failed_jobs'))->toBeTrue()
        ->and(Schema::hasColumns('failed_jobs', ['uuid', 'connection', 'queue', 'payload', 'exception', 'failed_at']))->toBeTrue();

    $commands = collect(app(Schedule::class)->events())->map(fn ($e) => $e->command)->filter()->implode("\n");
    expect($commands)->toContain('queue:prune-failed --hours=168');
});

it("journalise en critical le nom du travail et la classe d'exception seulement, sans charge utile", function () {
    Log::spy();

    expect(fn () => ChecklistFailingJob::dispatch('claire@example.test'))->toThrow(LogicException::class);

    Log::shouldHaveReceived('critical')->once()->withArgs(function (string $message, array $context) {
        return $context === ['job' => ChecklistFailingJob::class, 'connection' => 'sync', 'exception' => LogicException::class]
            && ! str_contains(json_encode($context), 'example.test')
            && ! str_contains($message, 'example.test');
    });
});

it("réagit à l'événement JobFailed publié par une file réelle", function () {
    Log::spy();
    $job = Mockery::mock(QueueJob::class);
    $job->shouldReceive('resolveName')->andReturn('App\\Jobs\\Exemple');

    event(new JobFailed('redis', $job, new RuntimeException('contient un jeton Bearer abcdefghijklmnopqrstuvwxyz0123456789')));

    Log::shouldHaveReceived('critical')->once()->withArgs(fn (string $m, array $c) => $c === ['job' => 'App\\Jobs\\Exemple', 'connection' => 'redis', 'exception' => RuntimeException::class]);
});

// ---------------------------------------------------------------------------------------------------------------------
// (4) Masquage des journaux
// ---------------------------------------------------------------------------------------------------------------------

function chkRecord(string $message, array $context = [], array $extra = []): LogRecord
{
    return new LogRecord(new DateTimeImmutable, 'test', Level::Info, $message, $context, $extra);
}

it('masque adresses e-mail, jetons porteurs et longs secrets dans le message', function () {
    $hex = bin2hex(random_bytes(24));
    $b64 = rtrim(strtr(base64_encode(random_bytes(40) ?: ''), '+/', '-_'), '=').'Aa1';
    $record = (new RedactSensitiveData)(chkRecord("Connexion de marie.dupont+test@exemple.fr avec Bearer abc.DEF-123_xyz~+/= puis clé $hex et jeton $b64 id 12|".Str::random(40)));

    expect($record->message)->toContain(RedactSensitiveData::MASK)
        ->not->toContain('marie.dupont')->not->toContain('exemple.fr')->not->toContain('abc.DEF')
        ->not->toContain($hex)->not->toContain($b64)->not->toContain('12|');
    expect($record->message)->toStartWith('Connexion de');
});

it("masque les clés password, token et secret du contexte, à toute profondeur, et nettoie les valeurs textuelles", function () {
    $record = (new RedactSensitiveData)(chkRecord('événement', [
        'password' => 'hunter2', 'new_password_confirmation' => 'hunter2', 'api_token' => 'abc', 'client_secret' => 'def', 'Authorization' => 'Bearer zzz',
        'user_id' => '0f3c1c2e-7a41-4d6b-9f0e-1a2b3c4d5e6f', 'attempts' => 3,
        'nested' => ['access_token' => 'ghi', 'email' => 'x@y.zz', 'note' => 'ok'],
    ], ['request_secret' => 'jkl', 'ip' => '203.0.113.9']));

    expect($record->context['password'])->toBe(RedactSensitiveData::MASK)
        ->and($record->context['new_password_confirmation'])->toBe(RedactSensitiveData::MASK)
        ->and($record->context['api_token'])->toBe(RedactSensitiveData::MASK)
        ->and($record->context['client_secret'])->toBe(RedactSensitiveData::MASK)
        ->and($record->context['Authorization'])->toBe(RedactSensitiveData::MASK)
        ->and($record->context['nested']['access_token'])->toBe(RedactSensitiveData::MASK)
        ->and($record->context['nested']['email'])->toBe(RedactSensitiveData::MASK)
        ->and($record->context['nested']['note'])->toBe('ok')
        ->and($record->extra['request_secret'])->toBe(RedactSensitiveData::MASK)
        // Les données non sensibles et les identifiants restent lisibles pour le diagnostic.
        ->and($record->context['user_id'])->toBe('0f3c1c2e-7a41-4d6b-9f0e-1a2b3c4d5e6f')
        ->and($record->context['attempts'])->toBe(3)
        ->and($record->extra['ip'])->toBe('203.0.113.9');
});

it('laisse intact un message ordinaire et les exceptions du contexte', function () {
    $e = new RuntimeException('boom');
    $record = (new RedactSensitiveData)(chkRecord('Anonymisation de 3 comptes dans /var/www/html/storage/app', ['exception' => $e]));

    expect($record->message)->toBe('Anonymisation de 3 comptes dans /var/www/html/storage/app')
        ->and($record->context['exception'])->toBe($e);
});

it('est appliqué à tous les canaux de config/logging.php (hors repli emergency)', function () {
    $without = collect(config('logging.channels'))->except('emergency')->reject(fn ($c) => in_array(RedactLogs::class, $c['tap'] ?? [], true))->keys()->all();

    expect($without)->toBe([])->and(config('logging.channels'))->toHaveKeys(['stack', 'single', 'daily', 'stderr']);
});

it('masque bien les données écrites par un vrai canal Laravel', function (string $via) {
    $path = sys_get_temp_dir().'/redact-'.Str::random(8).'.log';
    // Les définitions réelles de config/logging.php, avec un fichier de destination jetable.
    config(['logging.channels.probe_single' => ['path' => $path] + config('logging.channels.single')]);
    config(['logging.channels.probe_stack' => ['channels' => ['probe_single']] + config('logging.channels.stack')]);

    Log::channel("probe_$via")->warning('Échec pour {email}', ['email' => 'jean@exemple.fr', 'password' => 'hunter2', 'reset_token' => 'abc123', 'ok' => 'visible']);

    $written = file_get_contents($path);
    @unlink($path);
    expect($written)->toContain('Échec pour')->toContain('visible')
        ->not->toContain('jean@exemple.fr')->not->toContain('hunter2')->not->toContain('abc123');
})->with(['single', 'stack']);

// ---------------------------------------------------------------------------------------------------------------------
// (5) Vrais JWKS de Google et Apple (facultatif : RUN_NETWORK_TESTS=1)
// ---------------------------------------------------------------------------------------------------------------------

it("analyse les vrais JWKS publics avec le code de vérification OAuth du projet", function (string $provider) {
    $url = config("services.oauth.$provider.jwks_url");
    expect($url)->toStartWith('https://');

    // Chemin du vérificateur : récupération HTTP puis analyse (méthode privée jwks()).
    Cache::flush();
    $jwks = (new ReflectionMethod(JwtOAuthVerifier::class, 'jwks'))->invoke(new JwtOAuthVerifier, $url);
    expect($jwks)->toBeArray()->toHaveKey('keys');
    expect($jwks['keys'])->not->toBeEmpty();

    $keys = JWK::parseKeySet($jwks);
    expect($keys)->not->toBeEmpty();
    foreach ($keys as $kid => $key) {
        expect($kid)->toBeString()->not->toBeEmpty()
            ->and($key->getAlgorithm())->toBe('RS256');
    }
    // Un jeton signé par une autre clé est refusé proprement (InvalidOAuthToken), jamais par une erreur d'analyse.
    config(["services.oauth.$provider.client_ids" => ['client-de-test']]);
    expect(fn () => app(JwtOAuthVerifier::class)->verify($provider, 'eyJhbGciOiJSUzI1NiIsImtpZCI6Im5vbiJ9.e30.c2ln'))
        ->toThrow(App\Services\OAuth\InvalidOAuthToken::class);
})->with(['google', 'apple'])->skip(fn () => getenv('RUN_NETWORK_TESTS') !== '1', 'Test réseau : définir RUN_NETWORK_TESTS=1 pour le lancer.');
