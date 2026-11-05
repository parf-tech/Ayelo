<?php

use App\Events\BillingUpdated;
use App\Models\User;
use App\Services\Premium;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;

const RC_SECRET = 'secret-de-test';

function buyer(): User
{
    return User::factory()->create(['birthdate' => '1990-01-01']);
}

function rc(array $event, ?string $auth = 'Bearer '.RC_SECRET)
{
    config(['billing.webhook_secret' => RC_SECRET]);

    return test()->withHeader('Authorization', $auth ?? '')->postJson('/api/v1/webhooks/revenuecat', ['event' => array_merge([
        'id' => (string) Str::uuid(), 'app_user_id' => null, 'store' => 'APP_STORE',
    ], $event)]);
}

beforeEach(fn () => Event::fake([BillingUpdated::class]));

it('refuse un webhook sans secret ou avec un mauvais secret', function () {
    $u = buyer();
    rc(['type' => 'INITIAL_PURCHASE', 'app_user_id' => $u->id], null)->assertUnauthorized();
    rc(['type' => 'INITIAL_PURCHASE', 'app_user_id' => $u->id], 'Bearer faux')->assertUnauthorized();

    config(['billing.webhook_secret' => null]);
    test()->postJson('/api/v1/webhooks/revenuecat', ['event' => []])->assertUnauthorized();
    expect(DB::table('webhook_events')->count())->toBe(0);
});

it('active un abonnement Premium, puis le renouvelle sans créer de doublon', function () {
    $u = buyer();
    $start = now()->subMinute()->getTimestampMs();
    $end = now()->addMonth()->getTimestampMs();

    rc(['type' => 'INITIAL_PURCHASE', 'app_user_id' => $u->id, 'product_id' => 'premium_1m', 'original_transaction_id' => 'otx-1', 'transaction_id' => 'tx-1',
        'purchased_at_ms' => $start, 'expiration_at_ms' => $end])->assertOk()->assertJsonPath('result', 'processed');

    expect(Premium::active($u->id))->toBeTrue()->and(DB::table('subscriptions')->count())->toBe(1);
    Event::assertDispatched(BillingUpdated::class, fn ($e) => $e->userId === $u->id);

    rc(['type' => 'RENEWAL', 'app_user_id' => $u->id, 'product_id' => 'premium_1m', 'original_transaction_id' => 'otx-1', 'transaction_id' => 'tx-2',
        'purchased_at_ms' => $end, 'expiration_at_ms' => now()->addMonths(2)->getTimestampMs()])->assertOk();

    expect(DB::table('subscriptions')->count())->toBe(1);
    expect(strtotime(DB::table('subscriptions')->value('period_end')))->toBeGreaterThan(now()->addDays(40)->getTimestamp());
});

it('traite deux fois le même événement une seule fois (idempotence)', function () {
    $u = buyer();
    $evt = ['id' => 'evt-fixe', 'type' => 'NON_RENEWING_PURCHASE', 'app_user_id' => $u->id, 'product_id' => 'conversation_5', 'transaction_id' => 'tx-pack'];

    rc($evt)->assertOk()->assertJsonPath('result', 'processed');
    rc($evt)->assertOk()->assertJsonPath('result', 'duplicate');

    expect((int) DB::table('credit_ledger')->where('user_id', $u->id)->sum('delta'))->toBe(5)->and(DB::table('purchases')->count())->toBe(1);
    Event::assertDispatchedTimes(BillingUpdated::class, 1);
});

it('ne crédite pas deux fois la même transaction même avec deux identifiants d’événement différents', function () {
    $u = buyer();
    rc(['type' => 'NON_RENEWING_PURCHASE', 'app_user_id' => $u->id, 'product_id' => 'conversation_5', 'transaction_id' => 'tx-pack'])->assertOk();
    rc(['type' => 'NON_RENEWING_PURCHASE', 'app_user_id' => $u->id, 'product_id' => 'conversation_5', 'transaction_id' => 'tx-pack'])->assertOk();

    expect((int) DB::table('credit_ledger')->where('user_id', $u->id)->sum('delta'))->toBe(5);
});

it('garde l’accès Premium jusqu’à la fin de la période après une annulation, le retire à l’expiration', function () {
    $u = buyer();
    rc(['type' => 'INITIAL_PURCHASE', 'app_user_id' => $u->id, 'product_id' => 'premium_1m', 'original_transaction_id' => 'otx-9',
        'purchased_at_ms' => now()->getTimestampMs(), 'expiration_at_ms' => now()->addMonth()->getTimestampMs()]);

    rc(['type' => 'CANCELLATION', 'app_user_id' => $u->id, 'product_id' => 'premium_1m', 'original_transaction_id' => 'otx-9', 'cancel_reason' => 'UNSUBSCRIBE']);
    expect(DB::table('subscriptions')->value('status'))->toBe('cancelled')->and(Premium::active($u->id))->toBeTrue();

    rc(['type' => 'EXPIRATION', 'app_user_id' => $u->id, 'product_id' => 'premium_1m', 'original_transaction_id' => 'otx-9']);
    expect(DB::table('subscriptions')->value('status'))->toBe('expired')->and(Premium::active($u->id))->toBeFalse();
});

it('retire l’accès immédiatement en cas de remboursement', function () {
    $u = buyer();
    rc(['type' => 'INITIAL_PURCHASE', 'app_user_id' => $u->id, 'product_id' => 'premium_1m', 'original_transaction_id' => 'otx-r',
        'purchased_at_ms' => now()->getTimestampMs(), 'expiration_at_ms' => now()->addMonth()->getTimestampMs()]);

    rc(['type' => 'CANCELLATION', 'app_user_id' => $u->id, 'product_id' => 'premium_1m', 'original_transaction_id' => 'otx-r', 'cancel_reason' => 'CUSTOMER_SUPPORT']);

    expect(DB::table('subscriptions')->value('status'))->toBe('refunded')->and(Premium::active($u->id))->toBeFalse();
});

it('place un abonnement en période de grâce après un incident de paiement', function () {
    $u = buyer();
    rc(['type' => 'INITIAL_PURCHASE', 'app_user_id' => $u->id, 'product_id' => 'premium_1m', 'original_transaction_id' => 'otx-g',
        'purchased_at_ms' => now()->getTimestampMs(), 'expiration_at_ms' => now()->addMonth()->getTimestampMs()]);
    rc(['type' => 'BILLING_ISSUE', 'app_user_id' => $u->id, 'product_id' => 'premium_1m', 'original_transaction_id' => 'otx-g']);

    expect(DB::table('subscriptions')->value('status'))->toBe('grace')->and(Premium::active($u->id))->toBeTrue();
});

it('reprend les crédits d’un achat remboursé sans solde négatif, et signale la dépense préalable', function () {
    $u = buyer();
    rc(['type' => 'NON_RENEWING_PURCHASE', 'app_user_id' => $u->id, 'product_id' => 'conversation_5', 'transaction_id' => 'tx-ref']);
    // 3 crédits déjà dépensés.
    DB::table('credit_ledger')->insert(['id' => (string) Str::uuid(), 'user_id' => $u->id, 'credit_type' => 'conversation', 'delta' => -3, 'reason' => 'spend_conversation', 'idempotency_key' => 's1', 'created_at' => now()]);

    rc(['type' => 'CANCELLATION', 'app_user_id' => $u->id, 'product_id' => 'conversation_5', 'transaction_id' => 'tx-ref', 'cancel_reason' => 'CUSTOMER_SUPPORT'])->assertOk();

    expect((int) DB::table('credit_ledger')->where('user_id', $u->id)->sum('delta'))->toBe(0)->and(DB::table('purchases')->value('status'))->toBe('refunded');
    expect(DB::table('risk_events')->where('user_id', $u->id)->where('signal', 'refund_after_spend')->exists())->toBeTrue();

    // Un remboursement rejoué ne reprend rien de plus.
    rc(['type' => 'CANCELLATION', 'app_user_id' => $u->id, 'product_id' => 'conversation_5', 'transaction_id' => 'tx-ref', 'cancel_reason' => 'CUSTOMER_SUPPORT'])->assertOk();
    expect((int) DB::table('credit_ledger')->where('user_id', $u->id)->sum('delta'))->toBe(0);
});

it('ignore un utilisateur inconnu et un événement mal formé sans erreur', function () {
    rc(['type' => 'INITIAL_PURCHASE', 'app_user_id' => (string) Str::uuid(), 'product_id' => 'premium_1m', 'original_transaction_id' => 'o'])->assertOk()->assertJsonPath('result', 'ignored');
    rc(['type' => 'INITIAL_PURCHASE', 'app_user_id' => 'pas-un-uuid'])->assertOk()->assertJsonPath('result', 'ignored');
    config(['billing.webhook_secret' => RC_SECRET]);
    test()->withHeader('Authorization', 'Bearer '.RC_SECRET)->postJson('/api/v1/webhooks/revenuecat', ['x' => 1])->assertOk()->assertJsonPath('result', 'ignored');
    expect(DB::table('subscriptions')->count())->toBe(0);
});

it('expose offres, statut et historique au propriétaire seulement', function () {
    $u = buyer();
    $other = buyer();
    $bearer = 'Bearer '.$u->createToken('t')->plainTextToken;
    rc(['type' => 'NON_RENEWING_PURCHASE', 'app_user_id' => $u->id, 'product_id' => 'conversation_1', 'transaction_id' => 'tx-a', 'price' => 0.99, 'currency' => 'EUR']);
    rc(['type' => 'NON_RENEWING_PURCHASE', 'app_user_id' => $other->id, 'product_id' => 'conversation_1', 'transaction_id' => 'tx-b']);

    app('auth')->forgetGuards();
    test()->withHeader('Authorization', $bearer)->getJson('/api/v1/billing/offers')->assertOk()->assertJsonCount(3, 'subscriptions');
    test()->withHeader('Authorization', $bearer)->getJson('/api/v1/billing/status')->assertOk()->assertJsonPath('premium', false)->assertJsonPath('credits.conversation', 1);
    $tx = test()->withHeader('Authorization', $bearer)->getJson('/api/v1/billing/transactions')->assertOk()->json('data');
    expect($tx)->toHaveCount(1)->and($tx[0]['price_cents'])->toBe(99);

    test()->withHeader('Authorization', $bearer)->postJson('/api/v1/billing/sync')->assertOk()->assertJsonPath('credits.conversation', 1);
    app('auth')->forgetGuards();
    test()->withHeader('Authorization', '')->getJson('/api/v1/billing/status')->assertUnauthorized();
});
