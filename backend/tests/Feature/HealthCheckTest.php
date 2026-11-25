<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Redis;

/** Redirige la connexion Redis par défaut vers un port fermé : la connexion échoue immédiatement. */
function breakRedis(): void
{
    config([
        'database.redis.client' => 'predis',
        'database.redis.default.host' => '127.0.0.1',
        'database.redis.default.port' => '1',
        'database.redis.default.password' => null,
        'database.redis.default.timeout' => 0.5,
        'queue.default' => 'redis',
        'queue.connections.redis.connection' => 'default',
    ]);
    app()->forgetInstance('redis');
    app()->forgetInstance('queue');
    app()->forgetInstance('queue.connection');
    Redis::clearResolvedInstance('redis');
    Queue::clearResolvedInstance('queue');
}

/** Fait échouer la requête de sonde sans casser la transaction de test (mock partiel du gestionnaire). */
function breakDatabase(): void
{
    DB::partialMock()->shouldReceive('selectOne')->andThrow(new RuntimeException('SQLSTATE secret 127.0.0.1 refused'));
}

it('répond 200 quand la base répond et que Redis et la file ne sont pas utilisés', function () {
    useArrayCache(); // sous CACHE_STORE=redis (CI), le cache utilise Redis : la sonde le pinguerait
    $this->getJson('/api/v1/health')
        ->assertOk()
        ->assertExactJson(['status' => 'ok', 'db' => 'ok', 'redis' => 'skipped', 'queue' => 'skipped']);
});

it('répond 503 quand la base est injoignable, sans détail technique', function () {
    useArrayCache();
    breakDatabase();

    $response = $this->getJson('/api/v1/health')->assertStatus(503);

    expect($response->json())->toBe(['status' => 'degraded', 'db' => 'error', 'redis' => 'skipped', 'queue' => 'skipped']);
    // Aucune fuite : ni hôte, ni port, ni message d'exception du pilote.
    expect($response->getContent())->not->toContain('127.0.0.1')
        ->and($response->getContent())->not->toContain('SQLSTATE')
        ->and($response->getContent())->not->toContain('refused');
});

it('répond 503 quand Redis (file) est injoignable, sans détail technique', function () {
    breakRedis();

    $response = $this->getJson('/api/v1/health')->assertStatus(503);

    expect($response->json('status'))->toBe('degraded')
        ->and($response->json('db'))->toBe('ok')
        ->and($response->json('redis'))->toBe('error')
        ->and($response->json('queue'))->toBe('error')
        ->and($response->getContent())->not->toContain('127.0.0.1')
        ->and($response->getContent())->not->toContain('refused');
});

it('sonde la file en base quand QUEUE_CONNECTION=database', function () {
    useArrayCache();
    config(['queue.default' => 'database']);
    app()->forgetInstance('queue');
    Queue::clearResolvedInstance('queue');

    $this->getJson('/api/v1/health')
        ->assertOk()
        ->assertJson(['db' => 'ok', 'redis' => 'skipped', 'queue' => 'ok']);
});

it('garde /up bon marché : il ne touche pas à la base', function () {
    DB::partialMock()->shouldReceive('selectOne')->never();

    $this->get('/up')->assertOk();
});
