<?php

use App\Services\Storage\MediaStorage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\FakeMediaStorage;
use Tests\TestCase;

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->beforeEach(function () {
        // Aucun test n'appelle le vrai stockage objet.
        app()->instance(MediaStorage::class, new FakeMediaStorage);
    })
    ->in('Feature');
