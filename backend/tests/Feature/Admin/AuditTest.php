<?php

use App\Filament\Models\AuditEntry;
use App\Filament\Resources\AuditEntryResource;
use App\Models\StaffUser;
use App\Services\Admin\AdminService;
use App\Services\Admin\Audit;
use App\Services\Storage\MediaStorage;
use Filament\Facades\Filament;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Livewire\Livewire;
use Tests\Feature\Admin\Support\Seed;
use Tests\Support\FakeMediaStorage;

beforeEach(function () {
    Filament::setCurrentPanel('admin');
    app()->instance(MediaStorage::class, new FakeMediaStorage);
});

it('écrit acteur, action, objet, avant/après et IP', function () {
    $admin = Seed::staff('admin');
    $this->actingAs($admin, 'staff');
    $u = Seed::user();
    $m = Seed::media($u->id);

    app(\App\Services\Admin\MediaModeration::class)->approve($admin, $m);

    $row = Seed::audit('media.approved');
    expect($row->actor_staff_id)->toBe($admin->id)->and($row->subject_type)->toBe('media')->and($row->subject_id)->toBe($m)
        ->and($row->ip)->not->toBeNull()->and(json_decode($row->before, true))->toHaveKey('status')->and(json_decode($row->after, true))->toHaveKey('status')
        ->and($row->created_at)->not->toBeNull();
});

it('refuse toute modification ou suppression de audit_logs (déclencheur SQL)', function () {
    $admin = Seed::staff('admin');
    app(Audit::class)->record($admin, 'test.action', 'users', null, ['a' => 1], ['a' => 2]);
    $id = DB::table('audit_logs')->value('id');

    // Chaque tentative dans un point de sauvegarde : PostgreSQL annule la transaction de test après une erreur.
    expect(fn () => DB::transaction(fn () => DB::table('audit_logs')->where('id', $id)->update(['action' => 'falsifié'])))->toThrow(QueryException::class, 'append-only');
    expect(fn () => DB::transaction(fn () => DB::table('audit_logs')->where('id', $id)->delete()))->toThrow(QueryException::class, 'append-only');
    expect(fn () => DB::transaction(fn () => DB::statement('truncate audit_logs')))->toThrow(QueryException::class, 'append-only');
    expect(DB::table('audit_logs')->where('id', $id)->value('action'))->toBe('test.action');
});

it('refuse aussi toute écriture via le modèle du journal', function () {
    $admin = Seed::staff('admin');
    app(Audit::class)->record($admin, 'test.action');
    $entry = AuditEntry::first();

    expect(fn () => $entry->save())->toThrow(LogicException::class);
    expect(fn () => $entry->delete())->toThrow(LogicException::class);
    expect(fn () => $entry->update(['action' => 'x']))->toThrow(LogicException::class);
    expect(fn () => AuditEntry::create(['action' => 'x']))->toThrow(LogicException::class);
    expect(fn () => AuditEntry::destroy(1))->toThrow(LogicException::class);
});

it('n’offre dans l’interface aucune page ni action d’écriture sur le journal', function () {
    $admin = Seed::staff('admin');
    $this->actingAs($admin, 'staff');
    app(Audit::class)->record($admin, 'test.action', 'users', null, ['k' => 'v']);
    $entry = AuditEntry::first();

    expect(array_keys(AuditEntryResource::getPages()))->toBe(['index', 'view']);
    expect(AuditEntryResource::canCreate())->toBeFalse()->and(AuditEntryResource::canEdit($entry))->toBeFalse()->and(AuditEntryResource::canDelete($entry))->toBeFalse()
        ->and(AuditEntryResource::canDeleteAny())->toBeFalse();
    $policy = new \App\Filament\Policies\AuditEntryPolicy;
    expect($policy->update($admin, $entry))->toBeFalse()->and($policy->delete($admin, $entry))->toBeFalse()->and($policy->forceDelete($admin, $entry))->toBeFalse();

    $this->get('/admin/audit-log')->assertOk()->assertSee('test.action');
    $this->get('/admin/audit-log/'.$entry->id)->assertOk();
    $this->get('/admin/audit-log/create')->assertNotFound();
    $this->get('/admin/audit-log/'.$entry->id.'/edit')->assertNotFound();
    Livewire::test(AuditEntryResource\Pages\ListAuditEntries::class)->assertSuccessful()->assertTableActionDoesNotExist('delete')->assertTableActionDoesNotExist('edit');
});

it('masque tout champ secret avant écriture', function () {
    $admin = Seed::staff('admin');

    app(Audit::class)->record($admin, 'test.secret', 'users', null, ['password' => 'hunter2', 'nested' => ['totp_secret' => 'ABC', 'ok' => 'visible']], ['token' => 'tok', 'recovery_codes' => ['1', '2']]);

    $row = Seed::audit('test.secret');
    expect(json_encode($row))->not->toContain('hunter2')->and(json_encode($row))->not->toContain('"ABC"')->and(json_encode($row))->not->toContain('tok"')
        ->and(json_decode($row->before, true)['nested']['ok'])->toBe('visible');
});

it('journalise sans acteur uniquement pour la console (création de comptes)', function () {
    app(Audit::class)->record(null, 'staff.created', 'staff_users');

    expect(Seed::audit('staff.created')->actor_staff_id)->toBeNull();
});

it('chaque service d’administration exige un acteur StaffUser sur toutes ses méthodes publiques', function () {
    $services = [
        \App\Services\Admin\MediaModeration::class, \App\Services\Admin\ReportModeration::class, \App\Services\Admin\AppealReview::class,
        \App\Services\Admin\VerificationReview::class, \App\Services\Admin\UserAdmin::class, \App\Services\Admin\TicketDesk::class,
    ];

    foreach ($services as $class) {
        expect(is_subclass_of($class, AdminService::class))->toBeTrue();
        foreach ((new ReflectionClass($class))->getMethods(ReflectionMethod::IS_PUBLIC) as $method) {
            if ($method->isConstructor() || $method->getDeclaringClass()->getName() !== $class) {
                continue;
            }
            $first = $method->getParameters()[0] ?? null;
            expect($first?->getType()?->getName())->toBe(StaffUser::class, "{$class}::{$method->getName()} doit prendre l'acteur en premier argument");
        }
    }
});

it('une action est impossible si le journal ne peut pas être écrit : tout est annulé', function () {
    $admin = Seed::staff('admin');
    $u = Seed::user();
    $m = Seed::media($u->id);
    $r = Seed::report($u->id);
    [$vr] = Seed::verification(Seed::user('Vera')->id);
    $sanction = Seed::sanction($u->id, 'suspension', now()->addDay());
    $appeal = Seed::appeal($sanction, $u->id);
    $ticket = Seed::ticket($u->id);

    app()->bind(Audit::class, fn () => new class extends Audit
    {
        public function record(?StaffUser $actor, string $action, ?string $subjectType = null, ?string $subjectId = null, ?array $before = null, ?array $after = null): void
        {
            throw new RuntimeException('journal indisponible');
        }
    });

    $calls = [
        fn () => app(\App\Services\Admin\MediaModeration::class)->approve($admin, $m),
        fn () => app(\App\Services\Admin\MediaModeration::class)->reject($admin, $m, 'spam'),
        fn () => app(\App\Services\Admin\ReportModeration::class)->decide($admin, $r, 'ban', 'motif valable'),
        fn () => app(\App\Services\Admin\AppealReview::class)->accept($admin, $appeal),
        fn () => app(\App\Services\Admin\VerificationReview::class)->approve($admin, $vr),
        fn () => app(\App\Services\Admin\VerificationReview::class)->viewSelfie($admin, $vr),
        fn () => app(\App\Services\Admin\UserAdmin::class)->suspend($admin, $u->id, 'motif valable', 3),
        fn () => app(\App\Services\Admin\UserAdmin::class)->adjustCredits($admin, $u->id, 'conversation', 5, 'geste commercial'),
        fn () => app(\App\Services\Admin\UserAdmin::class)->grantPremium($admin, $u->id, now()->addDays(30), 'geste commercial'),
        fn () => app(\App\Services\Admin\TicketDesk::class)->update($admin, $ticket, 'closed', null),
    ];
    foreach ($calls as $call) {
        expect($call)->toThrow(RuntimeException::class, 'journal indisponible');
    }

    expect(DB::table('media')->find($m)->status)->toBe('processing');
    expect(DB::table('reports')->find($r)->status)->toBe('open');
    expect(DB::table('users')->find($u->id)->status)->toBe('active');
    expect(DB::table('appeals')->find($appeal)->status)->toBe('open');
    expect(DB::table('verification_requests')->find($vr)->status)->toBe('pending');
    expect(DB::table('credit_ledger')->where('user_id', $u->id)->count())->toBe(0);
    expect(DB::table('subscriptions')->where('user_id', $u->id)->count())->toBe(0);
    expect(DB::table('support_tickets')->find($ticket)->status)->toBe('open');
    expect(DB::table('sanctions')->where('user_id', $u->id)->count())->toBe(1);
});

it('un refus de droits n’écrit rien, ni action ni audit', function () {
    $support = Seed::staff('support');
    $u = Seed::user();
    $m = Seed::media($u->id);
    $before = Seed::auditCount();

    expect(fn () => app(\App\Services\Admin\MediaModeration::class)->approve($support, $m))->toThrow(\Illuminate\Auth\Access\AuthorizationException::class);

    expect(DB::table('media')->find($m)->status)->toBe('processing')->and(Seed::auditCount())->toBe($before);
});
