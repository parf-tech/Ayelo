<?php

use App\Services\CallsRoomService;
use App\Services\Storage\MediaStorage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\Support\FakeCallsRoomService;
use Tests\Support\FakeMediaStorage;
use Tests\TestCase;

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->beforeEach(function () {
        // Aucun test n'appelle le vrai stockage objet ni le vrai serveur LiveKit.
        app()->instance(MediaStorage::class, new FakeMediaStorage);
        app()->instance(CallsRoomService::class, new FakeCallsRoomService);
        // Aucune requête HTTP sortante par accident : un test qui en attend une la déclare avec Http::fake().
        Http::preventStrayRequests();
    })
    ->in('Feature');
