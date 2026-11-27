<?php

use App\Services\Storage\S3MediaStorage;
use App\Support\DeployPreflight;
use Aws\Command;
use Aws\Exception\AwsException;
use Aws\MockHandler;
use Aws\Result;
use GuzzleHttp\Promise\Create;
use GuzzleHttp\Psr7\Response;
use Illuminate\Support\Facades\Artisan;
use Psr\Http\Message\RequestInterface;

/*
 | Passe « prêt au déploiement » (2026-11-18) : réponse 401 sans en-tête Accept, comportement du client S3 face aux
 | erreurs, vérification de configuration avant déploiement (`deploy:preflight`) et variables documentées.
 */

// -- Authentification : 401 JSON même sans l'en-tête Accept ---------------------------------------------------------------

it("répond 401 JSON sur une route protégée même sans l'en-tête Accept (pas de 500 « Route [login] not defined »)", function () {
    $this->get('/api/v1/me')
        ->assertStatus(401)
        ->assertJson(['error' => ['code' => 'unauthenticated']]);
});

it('répond 401 JSON sur une écriture protégée sans en-tête Accept', function () {
    $this->post('/api/v1/me/export')
        ->assertStatus(401)
        ->assertJson(['error' => ['code' => 'unauthenticated']]);
});

// -- Client S3 : erreurs et délais ----------------------------------------------------------------------------------------

/** @param  array<string, mixed>  $options  Options supplémentaires du client S3 (ex. `http_handler`, `retries`). */
function s3Storage(?MockHandler $mock = null, array $options = []): S3MediaStorage
{
    config(['media.disk' => [
        'endpoint' => 'https://0123456789abcdef.r2.cloudflarestorage.com',
        'bucket' => 'media-test',
        'key' => 'AKIATESTKEY',
        'secret' => 'testsecret',
        'region' => 'auto',
    ]]);

    return new S3MediaStorage($options + ($mock ? ['handler' => $mock] : []));
}

function awsError(int $status, string $code): AwsException
{
    return new AwsException($code, new Command('HeadObject'), ['response' => new Response($status), 'code' => $code]);
}

it("head() renvoie la taille et le type d'un objet présent", function () {
    $mock = new MockHandler([new Result(['ContentLength' => 1234, 'ContentType' => 'image/png'])]);

    expect(s3Storage($mock)->head('u/x/profile_photo/y.png'))->toBe(['size' => 1234, 'mime' => 'image/png']);
});

it("head() renvoie null seulement quand l'objet n'existe pas (404)", function () {
    $mock = new MockHandler([awsError(404, 'NotFound')]);

    expect(s3Storage($mock)->head('u/x/profile_photo/absent.png'))->toBeNull();
});

it('head() laisse remonter une erreur d\'accès (403) : une mauvaise clé ne passe pas pour « objet absent »', function () {
    $mock = new MockHandler([awsError(403, 'AccessDenied')]);

    s3Storage($mock)->head('u/x/profile_photo/y.png');
})->throws(AwsException::class);

it('head() laisse remonter une panne du stockage (500)', function () {
    // Le SDK réessaie les 500 ; `retries => 0` isole ici la réponse du premier appel.
    $mock = new MockHandler([awsError(500, 'InternalError')]);

    s3Storage($mock, ['retries' => 0])->head('u/x/profile_photo/y.png');
})->throws(AwsException::class);

it('les clients S3 envoient un délai de connexion et de réponse (un stockage lent ne bloque pas un processus PHP-FPM)', function () {
    config(['media.http' => ['connect_timeout' => 2, 'timeout' => 7]]);
    $seen = [];
    $http = function (RequestInterface $request, array $options) use (&$seen) {
        $seen[] = $options;

        return Create::promiseFor(new Response(200, ['Content-Length' => '5', 'Content-Type' => 'image/png']));
    };
    $storage = s3Storage(null, ['http_handler' => $http]);

    // Client ordinaire, puis client de présignature : les deux portent les mêmes délais.
    $storage->head('u/x/profile_photo/y.png');
    $upload = (new ReflectionMethod($storage, 'uploadClient'))->invoke($storage);
    $upload->headObject(['Bucket' => 'media-test', 'Key' => 'u/x/profile_photo/y.png']);

    expect($seen)->toHaveCount(2);
    foreach ($seen as $options) {
        expect($options['connect_timeout'])->toBe(2)->and($options['timeout'])->toBe(7);
    }
});

it('le client S3 limite les nouvelles tentatives (délai total borné sous request_terminate_timeout de PHP-FPM)', function () {
    $mock = new MockHandler([awsError(500, 'InternalError'), awsError(500, 'InternalError'), awsError(500, 'InternalError')]);
    $storage = s3Storage($mock);

    try {
        $storage->head('u/x/profile_photo/y.png');
    } catch (AwsException) {
        // attendu : le dernier échec remonte
    }

    // 1 appel + au plus config('media.retries') nouvelles tentatives : il reste des réponses simulées inutilisées.
    expect($mock->count())->toBeGreaterThan(0);
});

it('les délais S3 ont une valeur par défaut finie', function () {
    $http = config('media.http');

    expect($http['connect_timeout'])->toBeGreaterThan(0)->toBeLessThanOrEqual(10)
        ->and($http['timeout'])->toBeGreaterThan(0)->toBeLessThanOrEqual(30);
});

// -- Variables documentées pour la production -----------------------------------------------------------------------------

it('chaque variable MEDIA_* lue par config/media.php est documentée dans infra/.env.prod.example', function () {
    $config = file_get_contents(base_path('config/media.php'));
    preg_match_all("/env\\('(MEDIA_[A-Z_]+)'/", $config, $m);
    $example = file_get_contents(base_path('../infra/.env.prod.example'));
    expect($m[1])->not->toBeEmpty();

    $missing = array_values(array_filter(
        array_unique($m[1]),
        fn (string $name) => ! preg_match('/^#?\s*'.preg_quote($name, '/').'=/m', $example),
    ));

    expect($missing)->toBe([]);
});

// -- deploy:preflight -----------------------------------------------------------------------------------------------------

function productionConfig(array $overrides = []): void
{
    config(array_merge([
        'app.env' => 'production',
        'app.debug' => false,
        'app.key' => 'base64:'.base64_encode(str_repeat('k', 32)),
        'app.url' => 'https://api.example.test',
        'app.admin_domain' => 'admin.example.test',
        'database.default' => 'pgsql',
        'queue.default' => 'redis',
        'safety.state_store' => 'state',
        'media.disk.endpoint' => 'https://0123456789abcdef.r2.cloudflarestorage.com',
        'media.disk.bucket' => 'media-prod',
        'media.disk.key' => 'AKIAPROD',
        'media.disk.secret' => 'secretprod',
        'media.auto_approve' => false,
        'media.sign_upload_headers' => true,
        'billing.webhook_secret' => 'whsec',
        'services.fcm.project_id' => 'p',
        'services.fcm.client_email' => 'a@b.test',
        'services.fcm.private_key' => 'k',
        'services.livekit.url' => 'wss://lk.example.test',
        'services.livekit.api_key' => 'k',
        'services.livekit.api_secret' => 's',
        'services.mail_webhook.secret' => 's',
        'services.oauth.google.client_ids' => ['google-id'],
        'services.oauth.apple.client_ids' => ['apple-id'],
        'sentry.dsn' => 'https://cle@o1.ingest.de.sentry.io/1',
    ], $overrides));
}

it('accepte une configuration de production complète, sans erreur ni avertissement', function () {
    productionConfig();

    expect(DeployPreflight::inspect())->toBe(['errors' => [], 'warnings' => []]);
});

it('signale chaque erreur bloquante avec le nom de la variable à corriger', function (array $override, string $variable) {
    productionConfig($override);

    $errors = DeployPreflight::inspect()['errors'];

    expect($errors)->not->toBeEmpty()
        ->and(implode("\n", $errors))->toContain($variable);
})->with([
    'pas en production' => [['app.env' => 'local'], 'APP_ENV'],
    'debug actif' => [['app.debug' => true], 'APP_DEBUG'],
    'clé absente' => [['app.key' => ''], 'APP_KEY'],
    'URL non https' => [['app.url' => 'http://api.example.test'], 'APP_URL'],
    'panneau sans domaine' => [['app.admin_domain' => null], 'ADMIN_DOMAIN'],
    'file synchrone' => [['queue.default' => 'sync'], 'QUEUE_CONNECTION'],
    'état de sécurité évincable' => [['safety.state_store' => null], 'SAFETY_STATE_STORE'],
    'stockage sans point d\'accès' => [['media.disk.endpoint' => ''], 'MEDIA_ENDPOINT'],
    'stockage sans seau' => [['media.disk.bucket' => null], 'MEDIA_BUCKET'],
    'stockage sans clé' => [['media.disk.key' => ''], 'MEDIA_ACCESS_KEY'],
    'stockage sans secret' => [['media.disk.secret' => ''], 'MEDIA_SECRET_KEY'],
    'point d\'accès non https' => [['media.disk.endpoint' => 'http://r2.example.test'], 'MEDIA_ENDPOINT'],
    'approbation automatique des médias' => [['media.auto_approve' => true], 'MEDIA_AUTO_APPROVE'],
]);

it('refuse une base autre que PostgreSQL (DB_CONNECTION)', function () {
    productionConfig();
    $original = config('database.default');

    try {
        config(['database.default' => 'sqlite']);
        $errors = DeployPreflight::inspect()['errors'];
    } finally {
        // Sans cette remise en état, la fin du test (retour arrière de la transaction) ouvrirait une base SQLite inexistante.
        config(['database.default' => $original]);
    }

    expect(implode('
', $errors))->toContain('DB_CONNECTION');
});

it('signale en avertissement (sans bloquer) les services facultatifs absents et la présignature non liée', function () {
    productionConfig([
        'media.sign_upload_headers' => false,
        'billing.webhook_secret' => '',
        'services.fcm.project_id' => null,
        'services.livekit.url' => null,
        'services.mail_webhook.secret' => null,
        'services.mail_webhook.svix_secret' => null, // sinon le .env du poste (secret Resend) masque l'avertissement
        'services.oauth.google.client_ids' => [],
        'services.oauth.apple.client_ids' => [],
    ]);

    $result = DeployPreflight::inspect();
    $warnings = implode("\n", $result['warnings']);

    expect($result['errors'])->toBe([])
        ->and($warnings)->toContain('GOOGLE_CLIENT_IDS')
        ->and($warnings)->toContain('APPLE_CLIENT_IDS')
        ->and($warnings)->toContain('MEDIA_SIGN_UPLOAD_HEADERS')
        ->and($warnings)->toContain('REVENUECAT_WEBHOOK_SECRET')
        ->and($warnings)->toContain('FCM_PROJECT_ID')
        ->and($warnings)->toContain('LIVEKIT_URL')
        ->and($warnings)->toContain('MAIL_WEBHOOK_SECRET');
});

it('ne signale pas les webhooks d\'e-mail quand l\'une des deux voies est configurée (Resend par Svix, ou Postmark par secret partagé)', function () {
    productionConfig(['services.mail_webhook.secret' => null, 'services.mail_webhook.svix_secret' => 'whsec_'.base64_encode('secret-de-test')]);
    expect(implode("\n", DeployPreflight::inspect()['warnings']))->not->toContain('MAIL_WEBHOOK');

    productionConfig(['services.mail_webhook.secret' => 'partage', 'services.mail_webhook.svix_secret' => null]);
    expect(implode("\n", DeployPreflight::inspect()['warnings']))->not->toContain('MAIL_WEBHOOK');
});

it('signale en avertissement un dossier du site sans catalogue des mentions légales (SITE_WEB_ROOT)', function () {
    productionConfig(['site.web_root' => sys_get_temp_dir().'/ayelo-sans-catalogue-'.bin2hex(random_bytes(4))]);

    $result = DeployPreflight::inspect();

    expect($result['errors'])->toBe([])
        ->and(implode("\n", $result['warnings']))->toContain('SITE_WEB_ROOT');
});

it('la commande deploy:preflight sort en erreur (code 1) et nomme le défaut', function () {
    productionConfig(['media.disk.bucket' => '']);

    $code = Artisan::call('deploy:preflight');

    expect($code)->toBe(1)
        ->and(Artisan::output())->toContain('MEDIA_BUCKET');
});

it('la commande deploy:preflight sort en succès (code 0) sur une configuration complète', function () {
    productionConfig();

    expect(Artisan::call('deploy:preflight'))->toBe(0);
});

it("n'affiche jamais la valeur d'un secret", function () {
    productionConfig(['media.disk.secret' => '', 'media.disk.key' => 'AKIA-VALEUR-VISIBLE-NON', 'app.debug' => true]);

    Artisan::call('deploy:preflight');

    expect(Artisan::output())->not->toContain('AKIA-VALEUR-VISIBLE-NON')->not->toContain('secretprod');
});
