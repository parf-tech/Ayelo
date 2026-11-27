<?php

use App\Support\DeployPreflight;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use Sentry\Breadcrumb;
use Sentry\Event;
use Sentry\ExceptionDataBag;
use Sentry\Frame;
use Sentry\Laravel\ServiceProvider as SentryServiceProvider;
use Sentry\SentrySdk;
use Sentry\Serializer\PayloadSerializer;
use Sentry\Stacktrace;
use Sentry\State\HubInterface;
use Sentry\Transport\Result;
use Sentry\Transport\ResultStatus;
use Sentry\Transport\TransportInterface;
use Sentry\UserDataBag;

/*
 * Les essais qui lèvent une vraie erreur désignent les secrets par leur rang (SECRETS_SENTRY[n]) : le SDK joint les lignes
 * de code voisines, qui ne doivent donc pas les contenir en clair.
 *
 * Suivi d'erreurs Sentry, FERMÉ tant que SENTRY_LARAVEL_DSN est vide. Les essais n'ouvrent aucune connexion : un faux
 * transport reçoit ce qui partirait, et la charge est mise en texte comme le ferait le SDK. Les valeurs qui désignent une
 * personne ne doivent apparaître nulle part dans cette charge.
 */

const SECRETS_SENTRY = [
    'jean.dupont@example.com',
    'pseudo-confidentiel',
    'texte du message prive',
    '203.0.113.9',
    '2001:db8::42',
    '3f2b8c1e-9a4d-4f6e-8b2a-1c3d5e7f9a0b',
    'abcdefghijklmnopqrstuvwxyz012345',
    'SECRET-DE-LIEN',
    'VALEUR-DE-COOKIE',
];

/** Transport d'essai : garde les événements au lieu de les envoyer. */
function fauxTransportSentry(): TransportInterface
{
    return new class implements TransportInterface
    {
        /** @var list<Event> */
        public array $events = [];

        public function send(Event $event): Result
        {
            $this->events[] = $event;

            return new Result(ResultStatus::success(), $event);
        }

        public function close(?int $timeout = null): Result
        {
            return new Result(ResultStatus::success());
        }
    };
}

/** Démarre le SDK comme en production avec une clé (réglages réels de config/sentry.php), mais sur le faux transport. */
function sentryOuvert(): TransportInterface
{
    $transport = fauxTransportSentry();
    config(['sentry.dsn' => 'https://cleessai@o1.ingest.de.sentry.io/1', 'sentry.transport' => $transport]);
    app()->forgetInstance(HubInterface::class);
    (new SentryServiceProvider(app()))->boot();

    return $transport;
}

/** Charge telle qu'elle serait envoyée (barres obliques rendues lisibles). */
function chargeSentry(Event $event): string
{
    $options = app(HubInterface::class)->getClient()->getOptions();

    return str_replace('\/', '/', (new PayloadSerializer($options))->serialize($event));
}

function attendreSansSecret(string $payload): void
{
    foreach (SECRETS_SENTRY as $secret) {
        expect($payload)->not->toContain($secret);
    }
}

afterEach(function () {
    SentrySdk::init();
});

it('n\'envoie rien tant que SENTRY_LARAVEL_DSN est vide', function () {
    expect(config('sentry.dsn'))->toBeNull()
        ->and(app(HubInterface::class)->getClient()?->getOptions()->getDsn())->toBeNull();
});

it('garde les protections quelles que soient les variables d\'environnement', function () {
    $variables = [
        'SENTRY_SEND_DEFAULT_PII' => 'true', 'SENTRY_TRACES_SAMPLE_RATE' => '1', 'SENTRY_PROFILES_SAMPLE_RATE' => '1',
        'SENTRY_ENABLE_LOGS' => 'true', 'SENTRY_BREADCRUMBS_SQL_BINDINGS_ENABLED' => 'true',
        'SENTRY_BREADCRUMBS_CACHE_ENABLED' => 'true',
    ];
    $before = $_SERVER;
    foreach ($variables as $name => $value) {
        $_SERVER[$name] = $_ENV[$name] = $value;
    }

    try {
        $config = require base_path('config/sentry.php');
    } finally {
        foreach (array_keys($variables) as $name) {
            unset($_SERVER[$name], $_ENV[$name]);
        }
        $_SERVER = $before;
    }

    expect($config['send_default_pii'])->toBeFalse()
        ->and($config['traces_sample_rate'])->toBeNull()
        ->and($config['profiles_sample_rate'])->toBeNull()
        ->and($config['enable_logs'])->toBeFalse()
        ->and($config['max_request_body_size'])->toBe('none')
        ->and($config['max_breadcrumbs'])->toBe(0)
        ->and(array_filter($config['breadcrumbs']))->toBe([]);
});

it('reste compatible avec config:cache et nomme un filtre appelable', function () {
    $config = config('sentry');

    expect(eval('return '.var_export($config, true).';'))->toEqual($config)
        ->and(is_callable($config['before_send']))->toBeTrue();
});

it('retire tout ce qui désigne une personne et garde de quoi diagnostiquer', function () {
    sentryOuvert();
    $frame = new Frame('envoyer', '/var/www/html/app/Services/Envoi.php', 42, vars: ['message' => 'texte du message prive']);
    $exception = new ExceptionDataBag(
        new RuntimeException(
            'Envoi impossible pour jean.dupont@example.com depuis 203.0.113.9 et 2001:db8::42, compte '
            .'3f2b8c1e-9a4d-4f6e-8b2a-1c3d5e7f9a0b, lien https://exemple.test/f?X-Amz-Signature=SECRET-DE-LIEN, '
            .'jeton 12|abcdefghijklmnopqrstuvwxyz012345 dans Envoi::lancer'
        ),
        new Stacktrace([$frame]),
    );

    $event = Event::createEvent();
    $event->setExceptions([$exception]);
    $event->setUser(UserDataBag::createFromArray(['id' => '3f2b8c1e-9a4d-4f6e-8b2a-1c3d5e7f9a0b', 'email' => 'jean.dupont@example.com', 'ip_address' => '203.0.113.9']));
    $event->setRequest([
        'method' => 'POST',
        'url' => 'https://api.exemple.test/api/v1/conversations/3f2b8c1e-9a4d-4f6e-8b2a-1c3d5e7f9a0b/messages?jeton=SECRET-DE-LIEN',
        'query_string' => 'jeton=SECRET-DE-LIEN',
        'headers' => ['Authorization' => ['Bearer 12|abcdefghijklmnopqrstuvwxyz012345'], 'X-Forwarded-For' => ['203.0.113.9']],
        'cookies' => ['session' => 'VALEUR-DE-COOKIE'],
        'data' => ['body' => 'texte du message prive'],
        'env' => ['REMOTE_ADDR' => '203.0.113.9'],
    ]);
    $event->setExtra(['exception_context' => ['pseudo' => 'pseudo-confidentiel']]);
    $event->setContext('laravel', ['pseudo' => 'pseudo-confidentiel']);
    $event->setContext('runtime', ['name' => 'php', 'version' => '8.4.1']);
    $event->setTags(['destinataire' => 'jean.dupont@example.com']);
    $event->setBreadcrumb([new Breadcrumb(Breadcrumb::LEVEL_INFO, Breadcrumb::TYPE_DEFAULT, 'cache', 'pseudo-confidentiel')]);

    $payload = chargeSentry(config('sentry.before_send')($event));

    attendreSansSecret($payload);
    expect($payload)->toContain('Envoi impossible')
        ->toContain('Envoi::lancer')
        ->toContain('RuntimeException')
        ->toContain('/api/v1/conversations/:id/messages')
        ->toContain('"method":"POST"')
        ->toContain('8.4.1');
});

it('ne recopie jamais les valeurs d\'une requête SQL en échec', function () {
    $transport = sentryOuvert();

    try {
        DB::transaction(fn () => DB::select('select cast(? as integer)', [SECRETS_SENTRY[1]]));
    } catch (QueryException $e) {
        report($e);
    }

    expect($transport->events)->toHaveCount(1);
    $payload = chargeSentry($transport->events[0]);
    attendreSansSecret($payload);
    expect($payload)->toContain('SQLSTATE[22P02]')->toContain('QueryException');
});

it('remonte l\'erreur d\'une requête HTTP sans ses en-têtes, son corps ni ses paramètres', function () {
    $transport = sentryOuvert();
    Route::post('/essai-sentry/{id}', function () {
        throw new RuntimeException('panne volontaire pour '.SECRETS_SENTRY[0]);
    });

    $this->withHeaders(['Authorization' => 'Bearer 12|'.SECRETS_SENTRY[6], 'Cookie' => 'session='.SECRETS_SENTRY[8]])
        ->postJson('/essai-sentry/'.SECRETS_SENTRY[5].'?jeton='.SECRETS_SENTRY[7], ['body' => SECRETS_SENTRY[2]])
        ->assertStatus(500);

    expect($transport->events)->toHaveCount(1);
    $payload = chargeSentry($transport->events[0]);
    attendreSansSecret($payload);
    expect($payload)->toContain('panne volontaire')->toContain('/essai-sentry/:id')->toContain('"method":"POST"');
});

it('n\'envoie aucun journal, même par les canaux que le paquet ajoute', function (string $canal) {
    $transport = sentryOuvert();
    config(['logging.channels.probe_stack' => ['channels' => [$canal]] + config('logging.channels.stack')]);

    Log::channel($canal)->critical('journal avec '.SECRETS_SENTRY[0]);
    Log::channel('probe_stack')->critical('journal avec '.SECRETS_SENTRY[0]);
    app(HubInterface::class)->getClient()->flush();

    expect($transport->events)->toBe([]);
})->with(['sentry', 'sentry_logs']);

it('signale au contrôle de déploiement une clé absente ou hors de la région UE', function (?string $dsn, array $attendus, array $absents) {
    config(['sentry.dsn' => $dsn]);

    $report = DeployPreflight::inspect();
    $warnings = implode(' ', $report['warnings']);

    expect(implode(' ', $report['errors']))->not->toContain('SENTRY');
    foreach ($attendus as $texte) {
        expect($warnings)->toContain($texte);
    }
    foreach ($absents as $texte) {
        expect($warnings)->not->toContain($texte);
    }
    expect($warnings)->not->toContain('cleessai');
})->with([
    'clé vide' => [null, ['SENTRY_LARAVEL_DSN est vide'], ['région UE']],
    'région américaine' => ['https://cleessai@o1.ingest.us.sentry.io/1', ['région UE'], ['SENTRY_LARAVEL_DSN est vide']],
    'hôte qui imite la région UE' => ['https://cleessai@ingest.de.sentry.io.exemple.test/1', ['région UE'], ['SENTRY_LARAVEL_DSN est vide']],
    'région UE' => ['https://cleessai@o1.ingest.de.sentry.io/1', [], ['SENTRY']],
]);
