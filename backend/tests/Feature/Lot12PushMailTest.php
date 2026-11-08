<?php

// Lot 12 : file push (réessais, pas de doublon, pas de texte dans la file) et rebonds / plaintes e-mail.

use App\Jobs\SendPush;
use App\Mail\AccountDeletionMail;
use App\Mail\PasswordResetMail;
use App\Mail\VerifyEmailMail;
use App\Models\User;
use App\Services\AccountMail;
use App\Services\MailSuppression;
use App\Services\Push\FcmPushNotifier;
use App\Services\Push\PushNotifier;
use App\Services\Push\RetryablePushException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

function l12_user(array $attrs = []): User
{
    return User::factory()->create(array_merge(['birthdate' => '1993-04-05', 'password' => 'Motdepasse2026'], $attrs));
}

function l12_device(string $userId, string $token, string $platform = 'android'): string
{
    $id = (string) Str::uuid();
    DB::table('devices')->insert(['id' => $id, 'user_id' => $userId, 'platform' => $platform, 'push_token' => $token, 'created_at' => now(), 'updated_at' => now()]);

    return $id;
}

/** @return array{0: User, 1: User, 2: string} deux membres avec une conversation issue d'un match */
function l12_pair(): array
{
    $users = [];
    foreach (['woman', 'man'] as $gender) {
        $u = l12_user();
        DB::table('profiles')->insert(['id' => (string) Str::uuid(), 'user_id' => $u->id, 'display_name' => 'P'.substr($u->id, 0, 5), 'gender' => $gender,
            'origin_country' => 'CM', 'residence_country' => 'FR', 'intent' => 'flirt', 'created_at' => now(), 'updated_at' => now()]);
        DB::table('notification_prefs')->insert(['user_id' => $u->id, 'created_at' => now(), 'updated_at' => now()]);
        $users[] = $u;
    }
    [$a, $b] = $users;
    $pair = [$a->id, $b->id];
    sort($pair, SORT_STRING);
    $match = (string) Str::uuid();
    $conv = (string) Str::uuid();
    DB::table('matches')->insert(['id' => $match, 'user_a' => $pair[0], 'user_b' => $pair[1], 'status' => 'active', 'created_at' => now(), 'updated_at' => now()]);
    DB::table('conversations')->insert(['id' => $conv, 'user_a' => $pair[0], 'user_b' => $pair[1], 'match_id' => $match, 'initiated_by' => $a->id,
        'unlocked_by' => 'match', 'status' => 'active', 'created_at' => now(), 'updated_at' => now()]);

    return [$a, $b, $conv];
}

/** Notifieur de test : `$script` est consommé jeton par jeton (true, false ou une exception à lever). */
function l12_notifier(array $script = []): object
{
    $notifier = new class($script) implements PushNotifier
    {
        public array $calls = [];

        public function __construct(public array $script) {}

        public function send(string $platform, string $token, string $title, string $body, array $data = []): bool
        {
            $this->calls[] = ['token' => $token, 'title' => $title, 'body' => $body];
            $result = $this->script[$token] ?? true;
            if ($result instanceof Throwable) {
                throw $result;
            }

            return $result;
        }
    };
    app()->instance(PushNotifier::class, $notifier);

    return $notifier;
}

// ---------- A : SendPush ----------

it('SendPush : file push, 5 essais, délais 10 s / 1 min / 5 min / 15 min', function () {
    $job = new SendPush('u', 'messages', 't', 'b');

    expect($job->queue)->toBe('push')->and($job->tries)->toBe(5)->and($job->backoff())->toBe([10, 60, 300, 900]);
});

it('P-14 : la tâche d’un message ne transporte pas le texte, seulement son identifiant', function () {
    Queue::fake();
    [$a, $b, $conv] = l12_pair();
    config(['push.message_preview' => true]);

    test()->withHeader('Authorization', 'Bearer '.$a->createToken('t')->plainTextToken)
        ->postJson("/api/v1/conversations/$conv/messages", ['client_id' => (string) Str::uuid(), 'type' => 'text', 'body' => 'texte-secret-du-message'])
        ->assertCreated();

    Queue::assertPushed(SendPush::class, fn (SendPush $j) => $j->userId === $b->id && $j->kind === 'messages' && $j->queue === 'push'
        && $j->messageId !== null && ! str_contains(serialize($j), 'texte-secret-du-message'));
});

it('P-14 : le corps est construit à l’envoi : générique par défaut, aperçu avec push.message_preview', function () {
    [$sender, $u, $conv] = l12_pair();
    l12_device($u->id, 'tok-1');
    $msg = (string) Str::uuid();
    DB::table('messages')->insert(['id' => $msg, 'conversation_id' => $conv, 'sender_id' => $sender->id, 'client_id' => (string) Str::uuid(), 'type' => 'text', 'body' => 'texte-secret-du-message', 'created_at' => now(), 'updated_at' => now()]);

    $job = new SendPush($u->id, 'messages', 'Nouveau message', 'Vous avez reçu un nouveau message.', ['type' => 'message'], $msg);
    expect(serialize($job))->not->toContain('texte-secret-du-message');

    $notifier = l12_notifier();
    $job->handle($notifier);
    expect($notifier->calls[0]['body'])->toBe('Vous avez reçu un nouveau message.');

    Cache::flush();
    config(['push.message_preview' => true]);
    $job->handle($notifier);
    expect($notifier->calls[1]['body'])->toBe('texte-secret-du-message');

    // Message supprimé entre-temps : plus rien à annoncer.
    Cache::flush();
    DB::table('messages')->where('id', $msg)->update(['deleted_at' => now(), 'body' => null]);
    $job->handle($notifier);
    expect($notifier->calls)->toHaveCount(2);
});

it('SendPush : un échec temporaire remet la tâche dans la file avec le délai de l’essai, sans effacer le jeton', function () {
    $u = l12_user();
    $dev = l12_device($u->id, 'tok-503');
    $notifier = l12_notifier(['tok-503' => new RetryablePushException('x')]);

    foreach ([[1, 10], [2, 60], [3, 300], [4, 900]] as [$attempt, $delay]) {
        $job = (new SendPush($u->id, 'messages', 't', 'b'))->withFakeQueueInteractions();
        $job->job->attempts = $attempt;
        $job->handle($notifier);
        $job->assertReleased($delay);
    }

    expect(DB::table('devices')->where('id', $dev)->value('push_token'))->toBe('tok-503');
});

it('SendPush : au 5e essai la tâche abandonne sans fuite de jeton ni de texte dans le journal', function () {
    $u = l12_user();
    l12_device($u->id, 'tok-503');
    $notifier = l12_notifier(['tok-503' => new RetryablePushException('x')]);
    Log::spy();

    $job = (new SendPush($u->id, 'messages', 'titre-x', 'corps-x'))->withFakeQueueInteractions();
    $job->job->attempts = 5;
    $job->handle($notifier);

    $job->assertNotReleased();
    Log::shouldHaveReceived('warning')->withArgs(fn ($message, $context) => ! str_contains(json_encode($context), 'tok-503') && ! str_contains(json_encode($context), 'corps-x'))->once();
});

it('SendPush : au réessai, un appareil déjà notifié ne reçoit pas de doublon', function () {
    $u = l12_user();
    l12_device($u->id, 'tok-ok');
    l12_device($u->id, 'tok-503');
    $notifier = l12_notifier(['tok-503' => new RetryablePushException('x')]);
    $msg = (string) Str::uuid();

    $first = (new SendPush($u->id, 'calls', 't', 'b', ['call_id' => $msg]))->withFakeQueueInteractions();
    $first->handle($notifier);
    $first->assertReleased(10);

    $notifier->script = []; // FCM répond de nouveau
    $second = (new SendPush($u->id, 'calls', 't', 'b', ['call_id' => $msg]));
    $second->handle($notifier);

    $tokens = array_column($notifier->calls, 'token');
    expect(array_count_values($tokens))->toBe(['tok-ok' => 1, 'tok-503' => 2]);
});

it('SendPush : un seul exemplaire en file par utilisateur et message (ShouldBeUnique)', function () {
    Queue::fake();
    $u = l12_user();
    $msg = (string) Str::uuid();

    $a = new SendPush($u->id, 'messages', 't', 'b', [], $msg);
    $b = new SendPush($u->id, 'messages', 't', 'b', [], $msg);
    $c = new SendPush($u->id, 'messages', 't', 'b', [], (string) Str::uuid());
    $x = new SendPush($u->id, 'messages', 't', 'b');
    $y = new SendPush($u->id, 'messages', 't', 'b');

    expect($a)->toBeInstanceOf(Illuminate\Contracts\Queue\ShouldBeUnique::class)
        ->and($a->uniqueId())->toBe($b->uniqueId())
        ->and($a->uniqueId())->not->toBe($c->uniqueId())
        ->and($x->uniqueId())->not->toBe($y->uniqueId()); // sans identifiant métier : jamais dédoublonné
});

it('SendPush : un jeton refusé (404 / INVALID_ARGUMENT) est effacé, un jeton remplacé entre-temps est épargné', function () {
    $u = l12_user();
    $dev = l12_device($u->id, 'tok-x');
    $notifier = l12_notifier(['tok-x' => false]);

    $job = new SendPush($u->id, 'messages', 't', 'b');
    $job->handle($notifier);
    expect(DB::table('devices')->where('id', $dev)->value('push_token'))->toBeNull();

    // L'appareil a enregistré un nouveau jeton pendant l'envoi : l'ancien refus ne l'efface pas.
    DB::table('devices')->where('id', $dev)->update(['push_token' => 'tok-neuf']);
    $notifier2 = new class implements PushNotifier
    {
        public function send(string $platform, string $token, string $title, string $body, array $data = []): bool
        {
            DB::table('devices')->where('push_token', $token)->update(['push_token' => 'tok-remplace']);

            return false;
        }
    };
    (new SendPush($u->id, 'messages', 't', 'b'))->handle($notifier2);
    expect(DB::table('devices')->where('id', $dev)->value('push_token'))->toBe('tok-remplace');
});

// ---------- A : FcmPushNotifier, erreurs temporaires ----------

function l12_fcm(): void
{
    $key = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
    openssl_pkey_export($key, $pem);
    config(['services.fcm.project_id' => 'projet-test', 'services.fcm.client_email' => 'envoi@projet-test.iam.gserviceaccount.com',
        'services.fcm.private_key' => str_replace("\n", '\n', $pem)]);
    Cache::forget('fcm.access_token');
}

it('FCM : 500, 503 et 429 lèvent RetryablePushException, jeton conservé', function (int $status) {
    l12_fcm();
    Http::fake([
        'oauth2.googleapis.com/*' => Http::response(['access_token' => 'a'], 200),
        'fcm.googleapis.com/*' => Http::response(['error' => ['status' => 'UNAVAILABLE']], $status),
    ]);

    expect(fn () => (new FcmPushNotifier)->send('android', 't1', 'a', 'b'))->toThrow(RetryablePushException::class);
})->with([500, 503, 429]);

it('FCM : délai dépassé ou réseau coupé lève RetryablePushException', function () {
    l12_fcm();
    Http::fake(['oauth2.googleapis.com/*' => Http::response(['access_token' => 'a'], 200),
        'fcm.googleapis.com/*' => fn () => throw new Illuminate\Http\Client\ConnectionException('cURL error 28: timeout')]);

    expect(fn () => (new FcmPushNotifier)->send('android', 't1', 'a', 'b'))->toThrow(RetryablePushException::class);
});

it('FCM : l’échange du jeton d’accès en 503 est réessayé, en 400 il ne l’est pas', function () {
    l12_fcm();
    Http::fake(['oauth2.googleapis.com/*' => Http::sequence()->push(['error' => 'x'], 503)->push(['error' => 'invalid_grant'], 400)]);
    expect(fn () => (new FcmPushNotifier)->send('android', 't1', 'a', 'b'))->toThrow(RetryablePushException::class);

    Cache::forget('fcm.access_token');
    expect((new FcmPushNotifier)->send('android', 't1', 'a', 'b'))->toBeTrue();
});

it('FCM : une réponse 400 sans INVALID_ARGUMENT ne supprime pas le jeton', function () {
    l12_fcm();
    Http::fake(['oauth2.googleapis.com/*' => Http::response(['access_token' => 'a'], 200),
        'fcm.googleapis.com/*' => Http::response(['error' => ['status' => 'FAILED_PRECONDITION']], 400)]);

    expect((new FcmPushNotifier)->send('android', 't1', 'a', 'b'))->toBeTrue();
});

// ---------- B : rebonds et plaintes ----------

const L12_SECRET = 'secret-de-test-webhook-mail';

function l12_hook(array $payload, ?string $secret = L12_SECRET, array $headers = [])
{
    config(['services.mail_webhook.secret' => L12_SECRET]);
    $headers = $secret === null ? $headers : ['X-Mail-Webhook-Secret' => $secret] + $headers;

    return test()->postJson('/api/v1/webhooks/mail', $payload, $headers);
}

it('webhook e-mail : refusé sans secret, avec un mauvais secret, et fermé quand MAIL_WEBHOOK_SECRET est vide', function () {
    $payload = ['RecordType' => 'Bounce', 'Type' => 'HardBounce', 'Email' => 'a@example.com'];

    l12_hook($payload, null)->assertStatus(401);
    l12_hook($payload, 'mauvais')->assertStatus(401);

    config(['services.mail_webhook.secret' => '']);
    test()->postJson('/api/v1/webhooks/mail', $payload, ['X-Mail-Webhook-Secret' => ''])->assertStatus(401);
    test()->postJson('/api/v1/webhooks/mail', $payload)->assertStatus(401);

    expect(DB::table('email_suppressions')->count())->toBe(0);
});

it('webhook e-mail : le secret peut aussi venir de Authorization: Bearer', function () {
    l12_hook(['RecordType' => 'SpamComplaint', 'Email' => 'bearer@example.com'], null, ['Authorization' => 'Bearer '.L12_SECRET])->assertOk();

    expect(DB::table('email_suppressions')->where('email', 'bearer@example.com')->value('reason'))->toBe('complaint');
});

it('webhook e-mail Postmark : rebond définitif et plainte sont supprimés, rebond temporaire ignoré', function () {
    l12_hook(['RecordType' => 'Bounce', 'Type' => 'HardBounce', 'Email' => 'Dur@Example.com'])->assertOk()->assertJson(['result' => 'ok', 'suppressed' => 1]);
    l12_hook(['RecordType' => 'SpamComplaint', 'Email' => 'plainte@example.com'])->assertOk();
    l12_hook(['RecordType' => 'Bounce', 'Type' => 'SpamComplaint', 'Email' => 'plainte2@example.com'])->assertOk();
    l12_hook(['RecordType' => 'Bounce', 'Type' => 'SoftBounce', 'Email' => 'mou@example.com'])->assertOk()->assertJson(['result' => 'ignored']);
    l12_hook(['RecordType' => 'Delivery', 'Recipient' => 'ok@example.com'])->assertOk()->assertJson(['result' => 'ignored']);

    $rows = array_change_key_case(DB::table('email_suppressions')->pluck('reason', 'email')->all());
    expect($rows)->toHaveCount(3)->and($rows['dur@example.com'])->toBe('hard_bounce')->and($rows['plainte@example.com'])->toBe('complaint');
    expect(app(MailSuppression::class)->isSuppressed('DUR@example.com'))->toBeTrue()->and(app(MailSuppression::class)->isSuppressed('mou@example.com'))->toBeFalse();
});

it('webhook e-mail Resend : email.bounced et email.complained lisent data.to[], rebond temporaire ignoré', function () {
    l12_hook(['type' => 'email.bounced', 'data' => ['to' => ['r1@example.com', 'r2@example.com']]])->assertOk()->assertJson(['suppressed' => 2]);
    l12_hook(['type' => 'email.bounced', 'data' => ['to' => ['perm@example.com'], 'bounce' => ['type' => 'Permanent']]])->assertOk();
    l12_hook(['type' => 'email.bounced', 'data' => ['to' => ['trans@example.com'], 'bounce' => ['type' => 'Transient']]])->assertOk()->assertJson(['result' => 'ignored']);
    l12_hook(['type' => 'email.complained', 'data' => ['to' => ['c@example.com']]])->assertOk();
    l12_hook(['type' => 'email.delivered', 'data' => ['to' => ['d@example.com']]])->assertOk()->assertJson(['result' => 'ignored']);

    expect(DB::table('email_suppressions')->pluck('reason', 'email')->all())->toBe([
        'r1@example.com' => 'hard_bounce', 'r2@example.com' => 'hard_bounce', 'perm@example.com' => 'hard_bounce', 'c@example.com' => 'complaint',
    ]);
});

it('webhook e-mail : idempotent, charges mal formées ignorées avec un 200, aucune adresse dans les journaux', function () {
    Log::spy();
    $payload = ['RecordType' => 'Bounce', 'Type' => 'HardBounce', 'Email' => 'deux@example.com'];

    l12_hook($payload)->assertOk()->assertJson(['suppressed' => 1]);
    l12_hook($payload)->assertOk()->assertJson(['suppressed' => 0]);
    expect(DB::table('email_suppressions')->count())->toBe(1);

    l12_hook(['RecordType' => 'Bounce', 'Type' => 'HardBounce', 'Email' => 'pas-une-adresse'])->assertOk()->assertJson(['suppressed' => 0]);
    l12_hook(['RecordType' => ['x'], 'Email' => ['y']])->assertOk()->assertJson(['result' => 'ignored']);
    l12_hook(['type' => 'email.bounced', 'data' => ['to' => [['x'], 12, null]]])->assertOk()->assertJson(['result' => 'ignored']);
    l12_hook(['type' => 'email.bounced', 'data' => 'oups'])->assertOk()->assertJson(['result' => 'ignored']);
    expect(DB::table('email_suppressions')->count())->toBe(1);

    Log::shouldNotHaveReceived('info', fn ($m, $c = []) => str_contains($m.json_encode($c), 'deux@example.com'));
});

it('webhook e-mail : le motif ne peut pas être forcé par la charge, la table refuse un motif inconnu', function () {
    expect(app(MailSuppression::class)->suppress('x@example.com', 'autre', 'postmark'))->toBeFalse();
    expect(fn () => DB::table('email_suppressions')->insert(['email' => 'y@example.com', 'reason' => 'autre', 'provider' => 'p']))->toThrow(Illuminate\Database\QueryException::class);
});

it('e-mails de compte : une adresse supprimée ne reçoit rien, sans jeton créé et avec la même réponse HTTP', function () {
    Mail::fake();
    $u = l12_user(['email_verified_at' => null]);
    $ok = l12_user();
    app(MailSuppression::class)->suppress($u->email, 'hard_bounce', 'postmark');

    $suppressed = test()->postJson('/api/v1/auth/password/forgot', ['email' => $u->email]);
    $normal = test()->postJson('/api/v1/auth/password/forgot', ['email' => $ok->email]);
    $unknown = test()->postJson('/api/v1/auth/password/forgot', ['email' => 'inconnu@example.com']);
    expect($suppressed->getStatusCode())->toBe($normal->getStatusCode())->toBe($unknown->getStatusCode())->toBe(204)
        ->and($suppressed->getContent())->toBe($normal->getContent());
    app()->terminate();

    Mail::assertSent(PasswordResetMail::class, 1);
    Mail::assertSent(PasswordResetMail::class, fn ($m) => $m->hasTo($ok->email));
    expect(DB::table('verification_codes')->where('user_id', $u->id)->count())->toBe(0);

    $mail = app(AccountMail::class);
    $mail->sendVerification($u);
    $mail->sendAccountDeletion($u, 'https://exemple.test/confirm-deletion?token=x');
    Mail::assertNotSent(VerifyEmailMail::class);
    Mail::assertNotSent(AccountDeletionMail::class);

    // Une adresse non supprimée reçoit toujours ses messages.
    $mail->sendVerification($ok);
    $mail->sendAccountDeletion($ok, 'https://exemple.test/confirm-deletion?token=x');
    Mail::assertSent(VerifyEmailMail::class, 1);
    Mail::assertSent(AccountDeletionMail::class, 1);
});
