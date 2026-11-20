<?php

/*
 | Webhook de rebonds Resend : Resend signe chaque envoi avec Svix (en-têtes svix-id, svix-timestamp, svix-signature) et ne permet pas
 | d'ajouter un en-tête secret. La signature HMAC-SHA256 couvre « id.horodatage.corps » ; le secret « whsec_… » est en base64.
 | L'ancien secret partagé (Postmark) reste valable quand aucun en-tête Svix n'est présent (voir Lot12PushMailTest).
 */

use Illuminate\Support\Facades\DB;

/** Secret de signature de test, au format Resend : « whsec_ » suivi de la clé en base64. */
function svixSecret(): string
{
    return 'whsec_'.base64_encode('test-svix-secret-pour-les-tests');
}

function svixSignature(string $secret, string $id, int $timestamp, string $body): string
{
    $key = base64_decode(str_starts_with($secret, 'whsec_') ? substr($secret, 6) : $secret);

    return 'v1,'.base64_encode(hash_hmac('sha256', "{$id}.{$timestamp}.{$body}", $key, true));
}

/** @param  array<string, mixed>  $payload */
function svixPost(array $payload, array $override = [], ?string $secret = null)
{
    config(['services.mail_webhook.svix_secret' => $secret ?? svixSecret(), 'services.mail_webhook.secret' => null]);
    $body = $override['body'] ?? json_encode($payload, JSON_THROW_ON_ERROR);
    $id = $override['id'] ?? 'msg_2abc';
    $timestamp = $override['timestamp'] ?? now()->getTimestamp();
    $signature = $override['signature'] ?? svixSignature(svixSecret(), $id, (int) $timestamp, $body);

    return test()->call('POST', '/api/v1/webhooks/mail', [], [], [], [
        'CONTENT_TYPE' => 'application/json',
        'HTTP_SVIX_ID' => $id,
        'HTTP_SVIX_TIMESTAMP' => (string) $timestamp,
        'HTTP_SVIX_SIGNATURE' => $signature,
    ], $body);
}

function svixBounce(string $to = 'parti@example.com'): array
{
    return ['type' => 'email.bounced', 'data' => ['to' => [$to], 'bounce' => ['type' => 'Permanent']]];
}

it('Svix : une signature valide est acceptée et supprime l\'adresse en rebond définitif', function () {
    svixPost(svixBounce())->assertOk()->assertJsonPath('result', 'ok')->assertJsonPath('suppressed', 1);

    expect(DB::table('email_suppressions')->where('email', 'parti@example.com')->value('provider'))->toBe('resend');
});

it('Svix : une plainte pour courrier indésirable est traitée comme avec le secret partagé', function () {
    svixPost(['type' => 'email.complained', 'data' => ['to' => ['plainte@example.com']]])->assertOk()->assertJsonPath('suppressed', 1);

    expect(DB::table('email_suppressions')->where('email', 'plainte@example.com')->value('reason'))->toBe('complaint');
});

it('Svix : une signature fausse, un autre secret ou un corps modifié sont refusés sans rien supprimer', function () {
    svixPost(svixBounce(), ['signature' => 'v1,'.base64_encode('pas-la-bonne-signature')])->assertStatus(401);

    $autre = 'whsec_'.base64_encode('un-autre-secret-de-test');
    svixPost(svixBounce(), ['signature' => svixSignature($autre, 'msg_2abc', now()->getTimestamp(), json_encode(svixBounce()))])->assertStatus(401);

    // Signé pour un corps, envoyé avec un autre (adresse différente).
    $signed = json_encode(svixBounce('a@example.com'));
    svixPost(svixBounce('b@example.com'), ['signature' => svixSignature(svixSecret(), 'msg_2abc', now()->getTimestamp(), $signed)])->assertStatus(401);

    expect(DB::table('email_suppressions')->count())->toBe(0);
});

it('Svix : l\'identifiant du message fait partie de la signature', function () {
    $body = json_encode(svixBounce());
    $signature = svixSignature(svixSecret(), 'msg_original', now()->getTimestamp(), $body);

    svixPost(svixBounce(), ['id' => 'msg_autre', 'signature' => $signature, 'body' => $body])->assertStatus(401);
});

it('Svix : un horodatage trop ancien ou trop lointain est refusé (rejeu)', function () {
    $body = json_encode(svixBounce());
    foreach ([-301, 301, -86400] as $shift) {
        $ts = now()->getTimestamp() + $shift;
        svixPost(svixBounce(), ['timestamp' => $ts, 'body' => $body, 'signature' => svixSignature(svixSecret(), 'msg_2abc', $ts, $body)])->assertStatus(401);
    }

    // À la limite de la tolérance, le message passe.
    $ts = now()->getTimestamp() - 290;
    svixPost(svixBounce(), ['timestamp' => $ts, 'body' => $body, 'signature' => svixSignature(svixSecret(), 'msg_2abc', $ts, $body)])->assertOk();
});

it('Svix : plusieurs signatures dans l\'en-tête (rotation du secret) : une seule correcte suffit', function () {
    $body = json_encode(svixBounce());
    $good = svixSignature(svixSecret(), 'msg_2abc', now()->getTimestamp(), $body);
    $old = 'v1,'.base64_encode('ancienne-signature');

    svixPost(svixBounce(), ['body' => $body, 'signature' => $old.' '.$good])->assertOk();
});

it('Svix : seule la version v1 est reconnue', function () {
    $body = json_encode(svixBounce());
    $signature = svixSignature(svixSecret(), 'msg_2abc', now()->getTimestamp(), $body);

    svixPost(svixBounce(), ['body' => $body, 'signature' => 'v2'.substr($signature, 2)])->assertStatus(401);
});

it('Svix : sans secret configuré, ou avec un secret mal formé, la route reste fermée même pour une signature cohérente', function () {
    svixPost(svixBounce(), [], '')->assertStatus(401);
    svixPost(svixBounce(), [], 'whsec_***pas-du-base64***')->assertStatus(401);

    expect(DB::table('email_suppressions')->count())->toBe(0);
});

it('Svix : le secret partagé ne remplace pas la signature quand les en-têtes Svix sont présents', function () {
    config(['services.mail_webhook.svix_secret' => svixSecret(), 'services.mail_webhook.secret' => 'partage']);

    test()->call('POST', '/api/v1/webhooks/mail', [], [], [], [
        'CONTENT_TYPE' => 'application/json',
        'HTTP_SVIX_ID' => 'msg_2abc',
        'HTTP_SVIX_TIMESTAMP' => (string) now()->getTimestamp(),
        'HTTP_SVIX_SIGNATURE' => 'v1,'.base64_encode('fausse'),
        'HTTP_X_MAIL_WEBHOOK_SECRET' => 'partage',
    ], json_encode(svixBounce()))->assertStatus(401);
});

it('Svix : sans en-tête Svix, le secret partagé (Postmark) fonctionne toujours', function () {
    config(['services.mail_webhook.svix_secret' => svixSecret(), 'services.mail_webhook.secret' => 'partage']);

    test()->postJson('/api/v1/webhooks/mail', ['RecordType' => 'SpamComplaint', 'Email' => 'spam@example.com'], ['X-Mail-Webhook-Secret' => 'partage'])
        ->assertOk()->assertJsonPath('suppressed', 1);
});
