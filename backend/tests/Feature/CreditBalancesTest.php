<?php

// Soldes de crédits : table `credit_balances` tenue à jour par un déclencheur sur `credit_ledger` (le registre reste la source de
// vérité, en ajout seulement). Quel que soit l'écrivain (achat RevenueCat, dépense à l'ouverture d'une conversation, ajustement
// de l'administration), le solde lu en O(1) est celui du registre. Lecture : GET /me, ouverture de conversation, administration.

use App\Models\User;
use App\Services\Conversations;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

function cb_user(): User
{
    $u = User::factory()->create(['birthdate' => '1995-06-15']);
    DB::table('profiles')->insert([
        'id' => (string) Str::uuid(), 'user_id' => $u->id, 'display_name' => 'C'.substr($u->id, 0, 5), 'gender' => 'woman',
        'origin_country' => 'CM', 'residence_country' => 'FR', 'intent' => 'flirt', 'created_at' => now(), 'updated_at' => now(),
    ]);

    return $u;
}

function cb_ledger(string $userId, string $type, int $delta, ?string $key = null): string
{
    $id = (string) Str::uuid();
    DB::table('credit_ledger')->insert(['id' => $id, 'user_id' => $userId, 'credit_type' => $type, 'delta' => $delta, 'reason' => $delta > 0 ? 'purchase' : 'spend_conversation',
        'idempotency_key' => $key ?? 'k-'.$id, 'created_at' => now()]);

    return $id;
}

/** Lignes de credit_balances qui diffèrent de la somme du registre (dans les deux sens). */
function cb_drift(): array
{
    return DB::select(<<<'SQL'
select coalesce(l.user_id, b.user_id) as user_id, coalesce(l.credit_type, b.credit_type) as credit_type, l.total, b.balance
from (select user_id, credit_type, sum(delta)::int as total from credit_ledger group by 1, 2) l
full join credit_balances b on b.user_id = l.user_id and b.credit_type = l.credit_type
where coalesce(l.total, 0) <> coalesce(b.balance, 0)
SQL);
}

it('tient le solde à jour à chaque ligne du registre, par type de crédit', function () {
    $a = cb_user();
    $b = cb_user();
    cb_ledger($a->id, 'conversation', 5);
    cb_ledger($a->id, 'conversation', -2);
    cb_ledger($a->id, 'proposal', 3);
    cb_ledger($b->id, 'conversation', 1);

    $balance = fn (User $u, string $type) => DB::table('credit_balances')->where('user_id', $u->id)->where('credit_type', $type)->value('balance');
    expect($balance($a, 'conversation'))->toBe(3)->and($balance($a, 'proposal'))->toBe(3)->and($balance($b, 'conversation'))->toBe(1);
    expect($balance($a, 'coin'))->toBeNull();
    expect(cb_drift())->toBe([]);
});

it('suit aussi la suppression et la modification d’une ligne du registre', function () {
    $a = cb_user();
    $first = cb_ledger($a->id, 'conversation', 10);
    $second = cb_ledger($a->id, 'conversation', 4);

    DB::table('credit_ledger')->where('id', $second)->update(['delta' => 6]);
    expect((int) DB::table('credit_balances')->where('user_id', $a->id)->value('balance'))->toBe(16);

    DB::table('credit_ledger')->where('id', $first)->delete();
    expect((int) DB::table('credit_balances')->where('user_id', $a->id)->value('balance'))->toBe(6)->and(cb_drift())->toBe([]);
});

it('reste identique au registre après une suite d’opérations mêlées', function () {
    $users = [cb_user(), cb_user(), cb_user()];
    mt_srand(42);
    foreach (range(1, 60) as $i) {
        $delta = mt_rand(1, 5) * (mt_rand(0, 2) === 0 ? -1 : 1);
        cb_ledger($users[mt_rand(0, 2)]->id, ['conversation', 'proposal', 'coin'][mt_rand(0, 2)], $delta);
    }

    expect(cb_drift())->toBe([]);
});

it('lit le solde sans parcourir le registre : 0 sans ligne, la valeur sinon', function () {
    $a = cb_user();
    $conversations = app(Conversations::class);
    expect($conversations->creditBalance($a->id))->toBe(0);

    cb_ledger($a->id, 'conversation', 7);
    cb_ledger($a->id, 'conversation', -3);
    expect($conversations->creditBalance($a->id))->toBe(4)->and($conversations->creditBalance($a->id, 'coin'))->toBe(0);

    // La valeur vient bien de la table de soldes, pas d'une somme du registre.
    DB::table('credit_balances')->where('user_id', $a->id)->update(['balance' => 99]);
    expect($conversations->creditBalance($a->id))->toBe(99);
});

it('GET /me renvoie les soldes de chaque type', function () {
    $a = cb_user();
    cb_ledger($a->id, 'conversation', 5);
    cb_ledger($a->id, 'proposal', 2);
    app('auth')->forgetGuards();

    test()->withHeader('Authorization', 'Bearer '.$a->createToken('t')->plainTextToken)->getJson('/api/v1/me')
        ->assertOk()->assertJsonPath('credits', ['conversation' => 5, 'proposal' => 2, 'coin' => 0]);

    DB::table('credit_balances')->where('user_id', $a->id)->where('credit_type', 'proposal')->update(['balance' => 88]);
    app('auth')->forgetGuards();
    test()->withHeader('Authorization', 'Bearer '.$a->createToken('t2')->plainTextToken)->getJson('/api/v1/me')->assertOk()->assertJsonPath('credits.proposal', 88);
});

it('la migration reconstruit les soldes depuis le registre (reprise des comptes existants), sans rien dupliquer', function () {
    $a = cb_user();
    $b = cb_user();
    cb_ledger($a->id, 'conversation', 5);
    cb_ledger($b->id, 'coin', 9);
    DB::table('credit_balances')->delete();
    DB::table('credit_balances')->insert(['user_id' => $a->id, 'credit_type' => 'conversation', 'balance' => 999]);

    $migration = require database_path('migrations/2026_11_24_000000_create_credit_balances.php');
    $migration->up();
    $migration->up();

    expect(cb_drift())->toBe([])->and(DB::table('credit_balances')->count())->toBe(2);
});
