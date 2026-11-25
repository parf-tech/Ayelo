<?php

use App\Services\CallsRoomService;
use App\Services\Storage\MediaStorage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\Support\FakeCallsRoomService;
use Tests\Support\FakeMediaStorage;
use Tests\TestCase;

/**
 * Épingle le cache du test en cours sur `array`, dont l'expiration suit l'horloge simulée (travel, setTestNow).
 * À appeler dans tout test qui fait vieillir une valeur du cache : Redis expire côté serveur, à l'heure réelle, donc le temps
 * simulé n'y change rien et le test échouerait sous CACHE_STORE=redis (job backend-prodlike de la CI).
 */
function useArrayCache(): void
{
    config(['cache.default' => 'array']);
}

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->beforeEach(function () {
        // Aucun test n'appelle le vrai stockage objet ni le vrai serveur LiveKit.
        app()->instance(MediaStorage::class, new FakeMediaStorage);
        app()->instance(CallsRoomService::class, new FakeCallsRoomService);
        // Aucune requête HTTP sortante par accident : un test qui en attend une la déclare avec Http::fake().
        Http::preventStrayRequests();
        // Un cache persistant (CACHE_STORE=redis dans le job backend-prodlike de la CI) garde limiteurs de débit, compteurs et
        // verrous d'un test à l'autre, alors que le cache `array` des essais locaux repart vide à chaque test : sans ce vidage,
        // la suite échoue en 429 / 409 dès que le cache n'est plus `array`. Le magasin d'état de sécurité vit sur la connexion
        // Redis `default` : il est vidé aussi quand le cache par défaut est Redis.
        if (config('cache.default') !== 'array') {
            Cache::flush();
            if (config('cache.default') === 'redis') {
                Cache::store('state')->flush();
            }
        }
    })
    ->in('Feature');
