<?php

// Diffusion temps réel d'un message : dans la requête (ShouldBroadcastNow), pas via la file partagée avec les pushes et les exports
// (revue CTO 1, risque 6 : la latence d'un message ne doit pas dépendre du plus lent des travaux). Un échec de la diffusion
// (Reverb arrêté) ne fait jamais échouer l'envoi : le message est déjà enregistré, le client le relira.

use App\Events\MessageCreated;
use App\Models\User;
use Illuminate\Broadcasting\Broadcasters\Broadcaster;
use Illuminate\Broadcasting\BroadcastEvent;
use Illuminate\Broadcasting\BroadcastManager;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Exceptions;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

/** @return array{0: string, 1: string} jeton du premier membre et identifiant de la conversation */
function mb_conversation(): array
{
    $make = function () {
        $u = User::factory()->create(['birthdate' => '1995-06-15']);
        DB::table('profiles')->insert([
            'id' => (string) Str::uuid(), 'user_id' => $u->id, 'display_name' => 'B'.substr($u->id, 0, 5), 'gender' => 'woman',
            'origin_country' => 'CM', 'residence_country' => 'FR', 'intent' => 'flirt', 'created_at' => now(), 'updated_at' => now(),
        ]);
        DB::table('notification_prefs')->insert(['user_id' => $u->id, 'created_at' => now(), 'updated_at' => now()]);

        return $u;
    };
    $a = $make();
    $b = $make();
    $pair = [$a->id, $b->id];
    sort($pair, SORT_STRING);
    $matchId = (string) Str::uuid();
    $convId = (string) Str::uuid();
    DB::table('matches')->insert(['id' => $matchId, 'user_a' => $pair[0], 'user_b' => $pair[1], 'status' => 'active', 'created_at' => now(), 'updated_at' => now()]);
    DB::table('conversations')->insert(['id' => $convId, 'user_a' => $pair[0], 'user_b' => $pair[1], 'match_id' => $matchId, 'initiated_by' => $a->id,
        'unlocked_by' => 'match', 'status' => 'active', 'created_at' => now(), 'updated_at' => now()]);

    return ['Bearer '.$a->createToken('t')->plainTextToken, $convId];
}

/** Remplace le diffuseur par un double : `$onBroadcast` reçoit le nom de l'événement et la charge. */
function mb_broadcaster(Closure $onBroadcast): void
{
    $driver = new class($onBroadcast) extends Broadcaster
    {
        public function __construct(private Closure $onBroadcast) {}

        public function auth($request) {}

        public function validAuthenticationResponse($request, $result) {}

        public function broadcast(array $channels, $event, array $payload = []): void
        {
            ($this->onBroadcast)($event, $payload);
        }
    };
    app(BroadcastManager::class)->extend('recording', fn () => $driver);
    config(['broadcasting.default' => 'recording', 'broadcasting.connections.recording' => ['driver' => 'recording']]);
}

function mb_send(string $bearer, string $conv, string $body = 'Salut')
{
    app('auth')->forgetGuards();

    return test()->withHeader('Authorization', $bearer)->postJson("/api/v1/conversations/$conv/messages", ['client_id' => (string) Str::uuid(), 'type' => 'text', 'body' => $body]);
}

it('MessageCreated se diffuse immédiatement (ShouldBroadcastNow)', function () {
    expect(new MessageCreated('c', []))->toBeInstanceOf(ShouldBroadcastNow::class);
});

it('envoie le message en direct dans la requête, sans pousser de tâche de diffusion dans la file', function () {
    Queue::fake();
    $seen = [];
    mb_broadcaster(function (string $event, array $payload) use (&$seen) {
        $seen[] = [$event, $payload];
    });
    [$bearer, $conv] = mb_conversation();

    mb_send($bearer, $conv, 'Bonjour')->assertCreated();

    Queue::assertNotPushed(BroadcastEvent::class);
    expect(collect($seen)->pluck(0)->all())->toContain('message.created');
    $created = collect($seen)->first(fn ($s) => $s[0] === 'message.created');
    expect($created[1]['message']['body'])->toBe('Bonjour');
});

it('un échec de diffusion ne fait pas échouer l’envoi : message enregistré, 201, erreur rapportée', function () {
    Exceptions::fake();
    mb_broadcaster(function () {
        throw new RuntimeException('reverb arrêté');
    });
    [$bearer, $conv] = mb_conversation();

    $res = mb_send($bearer, $conv, 'Toujours là')->assertCreated();

    expect(DB::table('messages')->where('id', $res->json('id'))->value('body'))->toBe('Toujours là');
    Exceptions::assertReported(fn (RuntimeException $e) => $e->getMessage() === 'reverb arrêté');
});
