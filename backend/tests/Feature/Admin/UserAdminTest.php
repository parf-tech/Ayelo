<?php

use App\Filament\Models\Member;
use App\Filament\Models\SupportTicket;
use App\Filament\Resources\MemberResource\Pages\ListMembers;
use App\Filament\Resources\MemberResource\Pages\ViewMember;
use App\Filament\Resources\MemberResource\RelationManagers\RiskEventsRelationManager;
use App\Filament\Resources\MemberResource\RelationManagers\SanctionsRelationManager;
use App\Filament\Resources\SupportTicketResource\Pages\ListSupportTickets;
use App\Filament\Resources\SupportTicketResource\Pages\ViewSupportTicket;
use App\Services\Admin\TicketDesk;
use App\Services\Admin\UserAdmin;
use App\Services\Conversations;
use App\Services\Premium;
use Filament\Facades\Filament;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Livewire\Livewire;
use Tests\Feature\Admin\Support\Seed;

beforeEach(function () {
    Filament::setCurrentPanel('admin');
    $this->admin = Seed::staff('admin');
    $this->actingAs($this->admin, 'staff');
});

// ---------- Recherche et fiche ----------

it('recherche un utilisateur par e-mail, identifiant ou nom', function () {
    $awa = Seed::user('Awa Diallo');
    $bob = Seed::user('Bob Martin');

    Livewire::test(ListMembers::class)->searchTable($awa->email)
        ->assertCanSeeTableRecords([Member::find($awa->id)])->assertCanNotSeeTableRecords([Member::find($bob->id)]);
    Livewire::test(ListMembers::class)->searchTable(substr($bob->id, 0, 13))
        ->assertCanSeeTableRecords([Member::find($bob->id)])->assertCanNotSeeTableRecords([Member::find($awa->id)]);
    Livewire::test(ListMembers::class)->searchTable('diallo')
        ->assertCanSeeTableRecords([Member::find($awa->id)])->assertCanNotSeeTableRecords([Member::find($bob->id)]);
    Livewire::test(ListMembers::class)->searchTable('%')->assertCanNotSeeTableRecords([Member::find($awa->id)]);
});

it('affiche la fiche : statut, score de risque, événements, sanctions, crédits', function () {
    $u = Seed::user('Awa Diallo', 'active', ['risk_score' => 42]);
    DB::table('risk_events')->insert(['id' => (string) Str::uuid(), 'user_id' => $u->id, 'signal' => 'many_reports', 'weight' => 30, 'created_at' => now()]);
    Seed::sanction($u->id, 'warning', null, 'Premier rappel');

    $this->get('/admin/users/'.$u->id)->assertOk()->assertSee('Awa Diallo')->assertSee('42');
    Livewire::test(RiskEventsRelationManager::class, ['ownerRecord' => Member::find($u->id), 'pageClass' => ViewMember::class])
        ->assertSee('many_reports');
    Livewire::test(SanctionsRelationManager::class, ['ownerRecord' => Member::find($u->id), 'pageClass' => ViewMember::class])
        ->assertSee('Premier rappel');
});

// ---------- Suspension, bannissement, réactivation ----------

it('suspend avec motif : sanction visible, compte suspendu, audit', function () {
    $u = Seed::user();

    Livewire::test(ViewMember::class, ['record' => $u->id])->callAction('suspend', data: ['days' => 7, 'reason' => 'Plaintes multiples confirmées']);

    expect(DB::table('users')->find($u->id)->status)->toBe('suspended');
    $s = DB::table('sanctions')->where('user_id', $u->id)->first();
    expect($s->kind)->toBe('suspension')->and($s->reason)->toBe('Plaintes multiples confirmées')->and($s->created_by)->toBe($this->admin->id)->and($s->report_id)->toBeNull();
    $a = Seed::audit('user.suspended');
    expect($a->actor_staff_id)->toBe($this->admin->id)->and($a->subject_id)->toBe($u->id)
        ->and(json_decode($a->before, true)['status'])->toBe('active')->and(json_decode($a->after, true)['status'])->toBe('suspended');
});

it('bannit avec motif puis réactive avec motif en terminant les restrictions', function () {
    $u = Seed::user();

    Livewire::test(ViewMember::class, ['record' => $u->id])->callAction('ban', data: ['reason' => 'Fraude avérée']);
    expect(DB::table('users')->find($u->id)->status)->toBe('banned');
    expect(Seed::audit('user.banned')->subject_id)->toBe($u->id);

    Livewire::test(ViewMember::class, ['record' => $u->id])->callAction('reactivate', data: ['reason' => 'Erreur de jugement']);
    expect(DB::table('users')->find($u->id)->status)->toBe('active');
    expect(DB::table('sanctions')->where('user_id', $u->id)->value('ends_at'))->not->toBeNull();
    $a = Seed::audit('user.reactivated');
    expect(json_decode($a->before, true)['status'])->toBe('banned')->and(json_decode($a->after, true)['reason'])->toBe('Erreur de jugement');
});

it('exige un motif pour toute action sur un utilisateur', function () {
    $u = Seed::user();
    $svc = app(UserAdmin::class);

    expect(fn () => $svc->suspend($this->admin, $u->id, '   ', 3))->toThrow(DomainException::class);
    expect(fn () => $svc->ban($this->admin, $u->id, 'x'))->toThrow(DomainException::class);
    expect(fn () => $svc->reactivate($this->admin, $u->id, 'motif correct'))->toThrow(DomainException::class); // pas suspendu
    expect(fn () => $svc->suspend($this->admin, $u->id, 'motif correct', 0))->toThrow(DomainException::class);
    expect(DB::table('sanctions')->count())->toBe(0)->and(Seed::auditCount('user.suspended'))->toBe(0);
});

it('ne sanctionne pas un compte en cours de suppression ou supprimé', function () {
    $u = Seed::user('Gone', 'deleting');

    expect(fn () => app(UserAdmin::class)->ban($this->admin, $u->id, 'motif correct'))->toThrow(DomainException::class);
    expect(DB::table('users')->find($u->id)->status)->toBe('deleting');
});

// ---------- Crédits ----------

it('ajuste les crédits : ligne admin_adjust, created_by, clé d’idempotence, audit', function () {
    $u = Seed::user();

    Livewire::test(ViewMember::class, ['record' => $u->id])
        ->callAction('adjust_credits', data: ['key' => 'abc-123', 'credit_type' => 'conversation', 'delta' => 5, 'note' => 'Compensation panne du 3 novembre']);

    $row = DB::table('credit_ledger')->where('user_id', $u->id)->first();
    expect($row->reason)->toBe('admin_adjust')->and($row->delta)->toBe(5)->and($row->credit_type)->toBe('conversation')
        ->and($row->created_by)->toBe($this->admin->id)->and($row->idempotency_key)->toBe('admin:abc-123')->and($row->note)->toBe('Compensation panne du 3 novembre');
    $a = Seed::audit('credits.adjusted');
    expect($a->actor_staff_id)->toBe($this->admin->id)->and($a->subject_id)->toBe($u->id)
        ->and(json_decode($a->after, true))->toMatchArray(['balance' => 5, 'delta' => 5, 'ledger_id' => $row->id]);
    expect(app(Conversations::class)->creditBalance($u->id))->toBe(5);
});

it('une double soumission du même formulaire n’ajuste qu’une fois', function () {
    $u = Seed::user();
    $svc = app(UserAdmin::class);

    $svc->adjustCredits($this->admin, $u->id, 'coin', 10, 'Geste commercial', 'k1');
    expect(fn () => $svc->adjustCredits($this->admin, $u->id, 'coin', 10, 'Geste commercial', 'k1'))->toThrow(DomainException::class);

    expect((int) DB::table('credit_ledger')->where('user_id', $u->id)->sum('delta'))->toBe(10)->and(Seed::auditCount('credits.adjusted'))->toBe(1);
});

it('exige un motif, refuse un solde négatif, un delta nul ou excessif et un type inconnu', function () {
    $u = Seed::user();
    $svc = app(UserAdmin::class);

    expect(fn () => $svc->adjustCredits($this->admin, $u->id, 'coin', 5, ''))->toThrow(DomainException::class);
    expect(fn () => $svc->adjustCredits($this->admin, $u->id, 'coin', 0, 'motif correct'))->toThrow(DomainException::class);
    expect(fn () => $svc->adjustCredits($this->admin, $u->id, 'coin', 5000, 'motif correct'))->toThrow(DomainException::class);
    expect(fn () => $svc->adjustCredits($this->admin, $u->id, 'or', 5, 'motif correct'))->toThrow(DomainException::class);
    expect(fn () => $svc->adjustCredits($this->admin, $u->id, 'coin', -1, 'motif correct'))->toThrow(DomainException::class);
    expect(DB::table('credit_ledger')->count())->toBe(0)->and(Seed::auditCount('credits.adjusted'))->toBe(0);
});

// ---------- Premium offert ----------

it('offre le Premium : abonnement promotional, granted_by, actif, audit', function () {
    $u = Seed::user();
    expect(Premium::active($u->id))->toBeFalse();

    Livewire::test(ViewMember::class, ['record' => $u->id])->callAction('grant_premium', data: ['days' => 30, 'note' => 'Partenariat influenceuse']);

    $sub = DB::table('subscriptions')->where('user_id', $u->id)->first();
    expect($sub->store)->toBe('promotional')->and($sub->granted_by)->toBe($this->admin->id)->and($sub->original_transaction_id)->toBeNull()->and($sub->status)->toBe('active');
    expect(Carbon::parse($sub->period_end)->diffInDays(now(), true))->toBeGreaterThan(29.9)->toBeLessThan(30.1);
    expect(Premium::active($u->id))->toBeTrue();
    $a = Seed::audit('premium.granted');
    expect($a->actor_staff_id)->toBe($this->admin->id)->and($a->subject_id)->toBe($u->id)->and(json_decode($a->after, true)['subscription_id'])->toBe($sub->id);
});

it('refuse un Premium offert sans motif, dans le passé ou au-delà de la limite', function () {
    $u = Seed::user();
    $svc = app(UserAdmin::class);

    expect(fn () => $svc->grantPremium($this->admin, $u->id, now()->addDays(10), ''))->toThrow(DomainException::class);
    expect(fn () => $svc->grantPremium($this->admin, $u->id, now()->subDay(), 'motif correct'))->toThrow(DomainException::class);
    expect(fn () => $svc->grantPremium($this->admin, $u->id, now()->addDays(800), 'motif correct'))->toThrow(DomainException::class);
    expect(DB::table('subscriptions')->count())->toBe(0);
});

it('retire un Premium offert, jamais un abonnement de store', function () {
    $u = Seed::user();
    $svc = app(UserAdmin::class);
    $svc->grantPremium($this->admin, $u->id, now()->addDays(30), 'Offert par erreur');
    $promo = DB::table('subscriptions')->where('user_id', $u->id)->value('id');
    $store = (string) Str::uuid();
    DB::table('subscriptions')->insert(['id' => $store, 'user_id' => $u->id, 'store' => 'apple', 'product_id' => 'premium_1m', 'status' => 'active',
        'period_start' => now(), 'period_end' => now()->addMonth(), 'original_transaction_id' => 'tx-1', 'created_at' => now(), 'updated_at' => now()]);

    expect(fn () => $svc->revokePremium($this->admin, $store, 'tentative'))->toThrow(DomainException::class);
    $svc->revokePremium($this->admin, $promo, 'Retrait suite à erreur');

    expect(DB::table('subscriptions')->find($promo)->status)->toBe('expired')->and(DB::table('subscriptions')->find($store)->status)->toBe('active');
    expect(Seed::audit('premium.revoked')->subject_id)->toBe($promo);
});

// ---------- Rôles ----------

it('seul l’admin peut ajuster les crédits, offrir le Premium ou sanctionner depuis la fiche', function () {
    $u = Seed::user();

    foreach (['moderator', 'support'] as $role) {
        $staff = Seed::staff($role);
        foreach ([
            fn () => app(UserAdmin::class)->adjustCredits($staff, $u->id, 'coin', 5, 'motif correct'),
            fn () => app(UserAdmin::class)->grantPremium($staff, $u->id, now()->addDays(5), 'motif correct'),
            fn () => app(UserAdmin::class)->suspend($staff, $u->id, 'motif correct', 2),
            fn () => app(UserAdmin::class)->ban($staff, $u->id, 'motif correct'),
        ] as $call) {
            expect($call)->toThrow(AuthorizationException::class);
        }
    }
    expect(DB::table('credit_ledger')->count())->toBe(0)->and(DB::table('subscriptions')->count())->toBe(0)->and(DB::table('users')->find($u->id)->status)->toBe('active');
});

it('le support voit la fiche en lecture seule : aucune action proposée', function () {
    $u = Seed::user();
    $this->actingAs(Seed::staff('support'), 'staff');

    $this->get('/admin/users/'.$u->id)->assertOk();
    foreach (['suspend', 'ban', 'reactivate', 'adjust_credits', 'grant_premium'] as $action) {
        Livewire::test(ViewMember::class, ['record' => $u->id])->assertActionHidden($action);
    }
});

// ---------- Tickets de support ----------

it('met à jour le statut et l’attribution d’un ticket, avec audit', function () {
    $support = Seed::staff('support');
    $this->actingAs($support, 'staff');
    $u = Seed::user();
    $t = Seed::ticket($u->id);

    Livewire::test(ListSupportTickets::class)->callTableAction('update', SupportTicket::find($t), data: ['status' => 'pending', 'assigned_to' => $support->id]);

    expect(DB::table('support_tickets')->find($t))->toMatchArray(['status' => 'pending', 'assigned_to' => $support->id]);
    $a = Seed::audit('ticket.updated');
    expect($a->actor_staff_id)->toBe($support->id)->and($a->subject_id)->toBe($t)->and(json_decode($a->before, true)['status'])->toBe('open');
});

it('s’attribue un ticket depuis la fiche et refuse d’attribuer à un modérateur', function () {
    $support = Seed::staff('support');
    $this->actingAs($support, 'staff');
    $t = Seed::ticket(Seed::user()->id);

    Livewire::test(ViewSupportTicket::class, ['record' => $t])->callAction('assign_me');
    expect(DB::table('support_tickets')->find($t)->assigned_to)->toBe($support->id);

    expect(fn () => app(TicketDesk::class)->update($support, $t, 'open', Seed::staff('moderator')->id))->toThrow(DomainException::class);
    expect(fn () => app(TicketDesk::class)->update($support, $t, 'inconnu', null))->toThrow(DomainException::class);
});
