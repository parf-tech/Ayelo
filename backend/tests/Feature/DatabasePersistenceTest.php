<?php

use Illuminate\Support\Facades\DB;

/*
 * Connexions PostgreSQL persistantes (DB_PERSISTENT, fermé par défaut) : une connexion survit à la requête et sert la suivante
 * du même processus PHP-FPM. Les essais ouvrent une connexion à part : la connexion par défaut est dans la transaction de
 * RefreshDatabase.
 */

/** Options PDO que donnerait config/database.php avec cette valeur de DB_PERSISTENT (null = variable absente). */
function pgsqlOptions(?string $value): array
{
    $before = ['server' => $_SERVER['DB_PERSISTENT'] ?? null, 'env' => $_ENV['DB_PERSISTENT'] ?? null];
    unset($_SERVER['DB_PERSISTENT'], $_ENV['DB_PERSISTENT']);
    if ($value !== null) {
        $_SERVER['DB_PERSISTENT'] = $_ENV['DB_PERSISTENT'] = $value;
    }

    try {
        $config = require base_path('config/database.php');

        return $config['connections']['pgsql']['options'] ?? [];
    } finally {
        unset($_SERVER['DB_PERSISTENT'], $_ENV['DB_PERSISTENT']);
        if ($before['server'] !== null) {
            $_SERVER['DB_PERSISTENT'] = $before['server'];
        }
        if ($before['env'] !== null) {
            $_ENV['DB_PERSISTENT'] = $before['env'];
        }
    }
}

/** Déclare la connexion d'essai « persist_probe » avec les options données et la rend neuve. */
function probeConnection(array $options): void
{
    config(['database.connections.persist_probe' => array_merge(
        config('database.connections.pgsql'),
        ['options' => $options],
    )]);
    DB::purge('persist_probe');
}

function backendPid(): int
{
    return (int) DB::connection('persist_probe')->scalar('select pg_backend_pid()');
}

afterEach(function () {
    DB::purge('persist_probe');
});

it('laisse les connexions non persistantes par défaut', function (?string $value) {
    expect(pgsqlOptions($value))->not->toHaveKey(PDO::ATTR_PERSISTENT);
})->with([
    'variable absente' => [null],
    'false' => ['false'],
    'vide' => [''],
    'valeur inconnue' => ['peut-être'],
]);

it('rend les connexions persistantes quand DB_PERSISTENT le demande', function (string $value) {
    expect(pgsqlOptions($value))->toHaveKey(PDO::ATTR_PERSISTENT, true);
})->with(['true', '1']);

it('réutilise la même connexion au serveur après une reconnexion', function () {
    probeConnection(pgsqlOptions('true'));
    $first = backendPid();

    DB::purge('persist_probe');

    expect(backendPid())->toBe($first);
});

it('ouvre une nouvelle connexion à chaque reconnexion quand la persistance est fermée', function () {
    probeConnection(pgsqlOptions(null));
    $first = backendPid();

    DB::purge('persist_probe');

    expect(backendPid())->not->toBe($first);
});

it('annule une transaction laissée ouverte avant de resservir la connexion', function () {
    probeConnection(pgsqlOptions('true'));
    $first = backendPid();
    DB::connection('persist_probe')->beginTransaction();
    DB::connection('persist_probe')->statement('create temporary table persist_probe_trace (x int)');
    DB::connection('persist_probe')->statement('select pg_advisory_xact_lock(424242)');

    DB::purge('persist_probe');

    expect(backendPid())->toBe($first)
        ->and(DB::connection('persist_probe')->scalar("select to_regclass('pg_temp.persist_probe_trace')"))->toBeNull()
        ->and((int) DB::connection('persist_probe')->scalar(
            "select count(*) from pg_locks where locktype = 'advisory' and pid = pg_backend_pid()"
        ))->toBe(0);
});

it('repart sur une connexion neuve quand le serveur a coupé l\'ancienne', function () {
    probeConnection(pgsqlOptions('true'));
    $first = backendPid();

    // Le second paramètre (PostgreSQL 14+) attend la fin du processus : sans lui, la coupure serait asynchrone.
    expect(DB::scalar('select pg_terminate_backend(?::int, 5000)', [$first]))->toBeTrue();
    DB::purge('persist_probe');

    expect(backendPid())->not->toBe($first);
});
