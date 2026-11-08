<?php

use App\Services\Push\FcmPushNotifier;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

function fcm_configure(): void
{
    $key = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
    openssl_pkey_export($key, $pem);
    config([
        'services.fcm.project_id' => 'projet-test',
        'services.fcm.client_email' => 'envoi@projet-test.iam.gserviceaccount.com',
        // Variable d'environnement sur une ligne : les retours à la ligne sont écrits « \n ».
        'services.fcm.private_key' => str_replace("\n", '\n', $pem),
    ]);
    Cache::forget('fcm.access_token');
}

it('FCM : envoie un message v1 avec le jeton d\'accès du compte de service', function () {
    fcm_configure();
    Http::fake([
        'oauth2.googleapis.com/*' => Http::response(['access_token' => 'jeton-acces'], 200),
        'fcm.googleapis.com/*' => Http::response(['name' => 'projects/projet-test/messages/1'], 200),
    ]);

    $ok = (new FcmPushNotifier)->send('android', 'jeton-android', 'Titre', 'Corps', ['conversation_id' => 'c1']);

    expect($ok)->toBeTrue();
    Http::assertSent(fn ($r) => str_contains($r->url(), '/v1/projects/projet-test/messages:send')
        && $r->hasHeader('Authorization', 'Bearer jeton-acces')
        && $r['message']['token'] === 'jeton-android'
        && $r['message']['data']['conversation_id'] === 'c1');
});

it('FCM : un jeton inconnu (404) ou invalide (400) est signalé pour suppression', function () {
    fcm_configure();
    Http::fake([
        'oauth2.googleapis.com/*' => Http::response(['access_token' => 'jeton-acces'], 200),
        'fcm.googleapis.com/*' => Http::sequence()->push(['error' => ['status' => 'NOT_FOUND']], 404)
            ->push(['error' => ['status' => 'INVALID_ARGUMENT']], 400),
    ]);

    expect((new FcmPushNotifier)->send('android', 't1', 'a', 'b'))->toBeFalse();
    expect((new FcmPushNotifier)->send('android', 't2', 'a', 'b'))->toBeFalse();
});

it('FCM : un refus du compte de service (403) ne supprime pas le jeton et se journalise en critique', function () {
    fcm_configure();
    Log::spy();
    Http::fake([
        'oauth2.googleapis.com/*' => Http::response(['access_token' => 'jeton-acces'], 200),
        'fcm.googleapis.com/*' => Http::response(['error' => ['status' => 'PERMISSION_DENIED']], 403),
    ]);

    expect((new FcmPushNotifier)->send('android', 't1', 'a', 'b'))->toBeTrue();
    expect(Cache::has('fcm.access_token'))->toBeFalse();
    Log::shouldHaveReceived('critical')->once();
});

it('FCM : une clé de compte de service illisible ne lève rien et ne fuit aucun secret', function () {
    config([
        'services.fcm.project_id' => 'projet-test',
        'services.fcm.client_email' => 'envoi@projet-test.iam.gserviceaccount.com',
        'services.fcm.private_key' => 'pas-une-cle',
    ]);
    Cache::forget('fcm.access_token');
    Log::spy();

    expect((new FcmPushNotifier)->send('android', 't1', 'a', 'b'))->toBeTrue();
    Log::shouldHaveReceived('critical')->withArgs(fn ($message, $context) => ! str_contains(json_encode($context), 'pas-une-cle'))->once();
});

it('FCM : sans configuration, rien n\'est envoyé ni supprimé', function () {
    config(['services.fcm.project_id' => null, 'services.fcm.client_email' => null, 'services.fcm.private_key' => null]);
    Http::fake();

    expect((new FcmPushNotifier)->send('android', 't1', 'a', 'b'))->toBeTrue();
    Http::assertNothingSent();
});

it('FCM : un jeton APNs iOS est ignoré sans être supprimé', function () {
    fcm_configure();
    Http::fake();

    expect((new FcmPushNotifier)->send('ios', str_repeat('ab', 32), 'a', 'b'))->toBeTrue();
    Http::assertNothingSent();
});
