<?php

// Compteurs de non lus et dernier message stockés sur `conversations` (unread_a, unread_b, last_message_id), tenus à jour par un
// déclencheur sur `messages` : GET /conversations ne parcourt plus les messages (revue CTO 1, risque 9). La table `messages` reste la
// source de vérité ; `counters:reconcile` détecte et corrige tout écart.

use App\Events\ConversationSignal;
use App\Events\MessageCreated;
use App\Jobs\SendPush;
use App\Models\User;
use App\Services\AccountDeletion;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

beforeEach(function () {
    Event::fake([MessageCreated::class, ConversationSignal::class]);
    Queue::fake([SendPush::class]);
});

/** @return array{0: User, 1: User, 2: string, 3: string, 4: string} deux membres, leurs jetons, la conversation (a = premier dans l'ordre des uuid) */
function cc_pair(): array
{
    $make = function () {
        $u = User::factory()->create(['birthdate' => '1995-06-15']);
        DB::table('profiles')->insert([
            'id' => (string) Str::uuid(), 'user_id' => $u->id, 'display_name' => 'N'.substr($u->id, 0, 5), 'gender' => 'woman',
            'origin_country' => 'CM', 'residence_country' => 'FR', 'intent' => 'flirt', 'created_at' => now(), 'updated_at' => now(),
        ]);
        DB::table('notification_prefs')->insert(['user_id' => $u->id, 'created_at' => now(), 'updated_at' => now()]);

        return $u;
    };
    $x = $make();
    $y = $make();
    [$a, $b] = $x->id < $y->id ? [$x, $y] : [$y, $x];
    $matchId = (string) Str::uuid();
    $conv = (string) Str::uuid();
    DB::table('matches')->insert(['id' => $matchId, 'user_a' => $a->id, 'user_b' => $b->id, 'status' => 'active', 'created_at' => now(), 'updated_at' => now()]);
    DB::table('conversations')->insert(['id' => $conv, 'user_a' => $a->id, 'user_b' => $b->id, 'match_id' => $matchId, 'initiated_by' => $a->id,
        'unlocked_by' => 'match', 'status' => 'active', 'created_at' => now(), 'updated_at' => now()]);

    return [$a, $b, 'Bearer '.$a->createToken('t')->plainTextToken, 'Bearer '.$b->createToken('t')->plainTextToken, $conv];
}

function cc_msg(string $conv, string $sender, array $o = []): string
{
    $id = (string) Str::uuid();
    DB::table('messages')->insert(array_merge([
        'id' => $id, 'conversation_id' => $conv, 'sender_id' => $sender, 'client_id' => (string) Str::uuid(), 'type' => 'text', 'body' => 'm',
        'created_at' => now()->toDateTimeString('microsecond'), 'updated_at' => now(),
    ], $o));

    return $id;
}

function cc_row(string $conv): object
{
    return DB::table('conversations')->where('id', $conv)->first(['unread_a', 'unread_b', 'last_message_id']);
}

/** Conversations dont les compteurs diffèrent d'un recalcul depuis `messages`. */
function cc_drift(): array
{
    return DB::select(<<<'SQL'
select c.id from conversations c where
  c.unread_a <> (select count(*) from messages m where m.conversation_id = c.id and m.sender_id <> c.user_a and m.read_at is null and m.deleted_at is null)
  or c.unread_b <> (select count(*) from messages m where m.conversation_id = c.id and m.sender_id <> c.user_b and m.read_at is null and m.deleted_at is null)
  or c.last_message_id is distinct from (select m.id from messages m where m.conversation_id = c.id and m.deleted_at is null order by m.created_at desc, m.id desc limit 1)
SQL);
}

function cc_as(string $bearer)
{
    app('auth')->forgetGuards();

    return test()->withHeader('Authorization', $bearer);
}

it('compte les non lus du destinataire et retient le dernier message à chaque envoi', function () {
    [$a, $b, , , $conv] = cc_pair();

    cc_msg($conv, $a->id);
    cc_msg($conv, $a->id);
    $last = cc_msg($conv, $b->id);

    $row = cc_row($conv);
    expect($row->unread_a)->toBe(1)->and($row->unread_b)->toBe(2)->and($row->last_message_id)->toBe($last)->and(cc_drift())->toBe([]);
});

it('un message plus ancien inséré après coup ne remplace pas le dernier', function () {
    [$a, , , , $conv] = cc_pair();
    $recent = cc_msg($conv, $a->id, ['created_at' => '2026-11-10 12:00:00.000000+00']);
    cc_msg($conv, $a->id, ['created_at' => '2026-11-09 12:00:00.000000+00']);

    expect(cc_row($conv)->last_message_id)->toBe($recent)->and(cc_drift())->toBe([]);
});

it('POST /read décompte les non lus ; GET /conversations les affiche pour chacun', function () {
    [$a, $b, $ab, $bb, $conv] = cc_pair();
    $first = cc_msg($conv, $a->id, ['created_at' => '2026-11-10 10:00:00.000000+00']);
    $second = cc_msg($conv, $a->id, ['created_at' => '2026-11-10 10:01:00.000000+00']);
    cc_msg($conv, $b->id, ['created_at' => '2026-11-10 10:02:00.000000+00']);

    expect(cc_as($bb)->getJson('/api/v1/conversations')->json('data.0.unread'))->toBe(2);
    expect(cc_as($ab)->getJson('/api/v1/conversations')->json('data.0.unread'))->toBe(1);

    cc_as($bb)->postJson("/api/v1/conversations/$conv/read", ['up_to_message_id' => $first])->assertNoContent();
    expect(cc_as($bb)->getJson('/api/v1/conversations')->json('data.0.unread'))->toBe(1);
    cc_as($bb)->postJson("/api/v1/conversations/$conv/read", ['up_to_message_id' => $second])->assertNoContent();
    expect(cc_as($bb)->getJson('/api/v1/conversations')->json('data.0.unread'))->toBe(0)->and(cc_drift())->toBe([]);
});

it('la liste lit les compteurs et le dernier message sur la conversation, sans parcourir les messages', function () {
    [$a, $b, $ab, , $conv] = cc_pair();
    $old = cc_msg($conv, $b->id, ['body' => 'ancien', 'created_at' => '2026-11-10 10:00:00.000000+00']);
    cc_msg($conv, $b->id, ['body' => 'récent', 'created_at' => '2026-11-10 10:05:00.000000+00']);

    DB::table('conversations')->where('id', $conv)->update(['unread_a' => 42, 'last_message_id' => $old]);

    $row = cc_as($ab)->getJson('/api/v1/conversations')->assertOk()->json('data.0');
    expect($row['unread'])->toBe(42)->and($row['last_message']['id'])->toBe($old)->and($row['last_message']['body'])->toBe('ancien')->and($row['last_message']['mine'])->toBeFalse();
});

it('supprimer le dernier message (soft delete) rend le précédent et décompte le non lu', function () {
    [$a, $b, , $bb, $conv] = cc_pair();
    $first = cc_msg($conv, $a->id, ['created_at' => '2026-11-10 10:00:00.000000+00']);
    $second = cc_msg($conv, $a->id, ['created_at' => '2026-11-10 10:01:00.000000+00']);
    expect(cc_row($conv)->unread_b)->toBe(2);

    cc_as(('Bearer '.$a->createToken('d')->plainTextToken))->deleteJson("/api/v1/messages/$second")->assertNoContent();

    $row = cc_row($conv);
    expect($row->last_message_id)->toBe($first)->and($row->unread_b)->toBe(1)->and(cc_drift())->toBe([]);

    // Rétablir un message supprimé le remet dans les comptes.
    DB::table('messages')->where('id', $second)->update(['deleted_at' => null]);
    $row = cc_row($conv);
    expect($row->last_message_id)->toBe($second)->and($row->unread_b)->toBe(2)->and(cc_drift())->toBe([]);
});

it('suit la suppression définitive de messages et celle d’une conversation entière', function () {
    [$a, $b, , , $conv] = cc_pair();
    $keep = cc_msg($conv, $a->id, ['created_at' => '2026-11-10 10:00:00.000000+00']);
    $gone = cc_msg($conv, $b->id, ['created_at' => '2026-11-10 10:01:00.000000+00']);

    DB::table('messages')->where('id', $gone)->delete();
    expect(cc_row($conv)->last_message_id)->toBe($keep)->and(cc_row($conv)->unread_a)->toBe(0)->and(cc_drift())->toBe([]);

    // Suppression en cascade : aucun message ne doit faire échouer la suppression de la conversation.
    DB::table('conversations')->where('id', $conv)->delete();
    expect(DB::table('messages')->where('conversation_id', $conv)->count())->toBe(0);
});

it('l’anonymisation d’un expéditeur retire ses messages des comptes', function () {
    [$a, $b, , , $conv] = cc_pair();
    cc_msg($conv, $a->id);
    cc_msg($conv, $a->id);
    $mine = cc_msg($conv, $b->id, ['created_at' => now()->addMinute()->toDateTimeString('microsecond')]);

    app(AccountDeletion::class)->anonymize($a->fresh());

    $row = cc_row($conv);
    expect($row->unread_b)->toBe(0)->and($row->unread_a)->toBe(1)->and($row->last_message_id)->toBe($mine)->and(cc_drift())->toBe([]);
});

it('reste identique à un recalcul après une suite d’opérations mêlées', function () {
    [$a, $b, , , $conv] = cc_pair();
    [$c, $d, , , $conv2] = cc_pair();
    $convs = [[$conv, $a->id, $b->id], [$conv2, $c->id, $d->id]];
    $ids = [];
    mt_srand(7);

    foreach (range(1, 120) as $i) {
        [$cid, $one, $two] = $convs[mt_rand(0, 1)];
        $op = mt_rand(0, 9);
        if ($op <= 4 || $ids === []) {
            $ids[] = cc_msg($cid, mt_rand(0, 1) ? $one : $two, ['created_at' => now()->subMinutes(mt_rand(0, 500))->toDateTimeString('microsecond')]);
        } elseif ($op <= 6) {
            DB::table('messages')->where('id', $ids[array_rand($ids)])->update(['read_at' => now()]);
        } elseif ($op === 7) {
            DB::table('messages')->where('id', $ids[array_rand($ids)])->update(['deleted_at' => now()]);
        } elseif ($op === 8) {
            DB::table('messages')->where('id', $ids[array_rand($ids)])->update(['deleted_at' => null, 'read_at' => null]);
        } else {
            $victim = array_rand($ids);
            DB::table('messages')->where('id', $ids[$victim])->delete();
            unset($ids[$victim]);
        }
    }

    expect(cc_drift())->toBe([]);
});

it('la migration reconstruit les compteurs des conversations existantes, sans rien dupliquer', function () {
    [$a, $b, , , $conv] = cc_pair();
    cc_msg($conv, $a->id);
    $last = cc_msg($conv, $b->id, ['created_at' => now()->addMinute()->toDateTimeString('microsecond')]);
    DB::table('conversations')->where('id', $conv)->update(['unread_a' => 9, 'unread_b' => 9, 'last_message_id' => null]);

    $migration = require database_path('migrations/2026_11_24_100000_add_conversation_counters.php');
    $migration->up();
    $migration->up();

    $row = cc_row($conv);
    expect($row->unread_a)->toBe(1)->and($row->unread_b)->toBe(1)->and($row->last_message_id)->toBe($last)->and(cc_drift())->toBe([]);
});

// ---------- counters:reconcile ----------

it('counters:reconcile signale un écart (code 1) sans rien changer, puis le corrige avec --fix', function () {
    [$a, , , , $conv] = cc_pair();
    cc_msg($conv, $a->id);
    $user = User::factory()->create(['birthdate' => '1995-06-15']);
    DB::table('credit_ledger')->insert(['id' => (string) Str::uuid(), 'user_id' => $user->id, 'credit_type' => 'conversation', 'delta' => 4, 'reason' => 'purchase',
        'idempotency_key' => 'k-rec', 'created_at' => now()]);
    DB::table('conversations')->where('id', $conv)->update(['unread_b' => 5, 'last_message_id' => null]);
    DB::table('credit_balances')->where('user_id', $user->id)->update(['balance' => 100]);

    $this->artisan('counters:reconcile')->expectsOutputToContain('conversations : 1')->expectsOutputToContain('soldes de crédits : 1')->assertExitCode(1);
    expect(cc_row($conv)->unread_b)->toBe(5)->and((int) DB::table('credit_balances')->where('user_id', $user->id)->value('balance'))->toBe(100);

    $this->artisan('counters:reconcile', ['--fix' => true])->assertExitCode(0);
    expect(cc_drift())->toBe([])->and((int) DB::table('credit_balances')->where('user_id', $user->id)->value('balance'))->toBe(4);

    $this->artisan('counters:reconcile')->expectsOutputToContain('Aucun écart')->assertExitCode(0);
});
