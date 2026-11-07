<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Redis;
use Throwable;

/**
 * Sonde de santé applicative (GET /api/v1/health) : base de données, Redis et file d'attente.
 *
 * - 200 si tout ce qui est utilisé répond, 503 sinon. Le corps ne donne que « ok » / « error » / « skipped » par
 *   composant : jamais de message d'exception, d'hôte, de nom de connexion ni de version.
 * - « skipped » : le composant n'est pas utilisé dans cette configuration (ex. file « sync » en test).
 * - /up (route de santé de Laravel) reste la sonde bon marché pour le répartiteur de charge : elle ne touche à rien.
 */
class HealthController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $db = $this->probe(fn () => DB::selectOne('select 1 as ok'));
        $redis = $this->redisStatus();
        $queue = $this->queueStatus();

        $healthy = ! in_array('error', [$db, $redis, $queue], true);

        return response()->json(
            ['status' => $healthy ? 'ok' : 'degraded', 'db' => $db, 'redis' => $redis, 'queue' => $queue],
            $healthy ? 200 : 503
        );
    }

    private function probe(callable $check): string
    {
        try {
            $check();

            return 'ok';
        } catch (Throwable) {
            return 'error';
        }
    }

    /** Redis n'est sondé que si la file, le cache, les sessions ou la diffusion Reverb l'utilisent. */
    private function redisStatus(): string
    {
        $connections = [];

        if (config('queue.connections.'.config('queue.default').'.driver') === 'redis') {
            $connections[] = (string) config('queue.connections.'.config('queue.default').'.connection', 'default');
        }
        if (config('session.driver') === 'redis') {
            $connections[] = (string) (config('session.connection') ?: 'default');
        }
        if (config('reverb.servers.reverb.scaling.enabled')) {
            $connections[] = 'default';
        }
        if (config('cache.stores.'.config('cache.default').'.driver') === 'redis') {
            $connections[] = (string) config('cache.stores.'.config('cache.default').'.connection', 'cache');
        }

        // Magasin d'état de sécurité (jeton d'âge, compteurs) : s'il est sur Redis, une panne se voit ici.
        $stateStore = config('safety.state_store');
        if ($stateStore && config('cache.stores.'.$stateStore.'.driver') === 'redis') {
            $connections[] = (string) config('cache.stores.'.$stateStore.'.connection', 'default');
        }

        $connections = array_unique($connections);
        if ($connections === []) {
            return 'skipped';
        }

        foreach ($connections as $name) {
            if ($this->probe(fn () => Redis::connection($name)->ping()) === 'error') {
                return 'error';
            }
        }

        return 'ok';
    }

    /** Joignabilité de la file : lecture de sa taille (liste Redis ou table `jobs`). Ne dit rien du worker. */
    private function queueStatus(): string
    {
        $driver = config('queue.connections.'.config('queue.default').'.driver');
        if (! in_array($driver, ['redis', 'database'], true)) {
            return 'skipped';
        }

        return $this->probe(fn () => Queue::size());
    }
}
