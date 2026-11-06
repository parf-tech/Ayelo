<?php

use App\Filament\Widgets\AdminStatsWidget;
use App\Models\StaffUser;
use App\Services\Admin\DashboardStats;
use App\Services\Admin\Permissions;
use Filament\Facades\Filament;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Livewire\Livewire;
use Tests\Feature\Admin\Support\Seed;

beforeEach(function () {
    Filament::setCurrentPanel('admin');
});

// Matrice des droits (docs/11) : moderator = médias, signalements, contestations, vérifications ;
// support = tickets + lecture seule des utilisateurs ; admin = tout.
const PAGES = [
    '/admin/media-queue' => ['moderator' => true, 'support' => false, 'admin' => true],
    '/admin/reports' => ['moderator' => true, 'support' => false, 'admin' => true],
    '/admin/appeals' => ['moderator' => true, 'support' => false, 'admin' => true],
    '/admin/verifications' => ['moderator' => true, 'support' => false, 'admin' => true],
    '/admin/users' => ['moderator' => false, 'support' => true, 'admin' => true],
    '/admin/tickets' => ['moderator' => false, 'support' => true, 'admin' => true],
    '/admin/audit-log' => ['moderator' => false, 'support' => false, 'admin' => true],
    '/admin' => ['moderator' => true, 'support' => true, 'admin' => true],
];

it('applique la matrice de droits sur chaque page, par rôle', function () {
    foreach (['moderator', 'support', 'admin'] as $role) {
        $staff = Seed::staff($role);
        foreach (PAGES as $path => $allowed) {
            $this->flushSession(); // AuthenticateSession compare le hash de mot de passe mémorisé : une session par membre du personnel.
            $response = $this->actingAs($staff, 'staff')->get($path);
            $allowed[$role] ? $response->assertOk() : $response->assertForbidden();
        }
    }
});

it('applique la matrice aussi sur les fiches (objets existants)', function () {
    $u = Seed::user();
    $report = Seed::report($u->id);
    $ticket = Seed::ticket($u->id);
    [$ver] = Seed::verification(Seed::user('Vera')->id);
    $appeal = Seed::appeal(Seed::sanction($u->id, 'warning', null), $u->id);
    app(\App\Services\Admin\Audit::class)->record(Seed::staff('admin'), 'x.y');
    $entry = DB::table('audit_logs')->value('id');

    $records = [
        "/admin/reports/{$report}" => ['moderator' => true, 'support' => false, 'admin' => true],
        "/admin/tickets/{$ticket}" => ['moderator' => false, 'support' => true, 'admin' => true],
        "/admin/verifications/{$ver}" => ['moderator' => true, 'support' => false, 'admin' => true],
        "/admin/appeals/{$appeal}" => ['moderator' => true, 'support' => false, 'admin' => true],
        "/admin/users/{$u->id}" => ['moderator' => false, 'support' => true, 'admin' => true],
        "/admin/audit-log/{$entry}" => ['moderator' => false, 'support' => false, 'admin' => true],
    ];
    foreach (['moderator', 'support', 'admin'] as $role) {
        $staff = Seed::staff($role);
        foreach ($records as $path => $allowed) {
            $this->flushSession(); // AuthenticateSession compare le hash de mot de passe mémorisé : une session par membre du personnel.
            $response = $this->actingAs($staff, 'staff')->get($path);
            $allowed[$role] ? $response->assertOk() : $response->assertForbidden();
        }
    }
});

it('répond 404 (jamais une erreur SQL) pour une clé de fiche mal formée', function () {
    $this->actingAs(Seed::staff('admin'), 'staff');

    foreach (['reports', 'users', 'tickets', 'appeals', 'verifications', 'audit-log'] as $slug) {
        $this->get("/admin/{$slug}/create")->assertNotFound();
        $this->get("/admin/{$slug}/".Str::uuid())->assertNotFound();
    }
});

it('expose la matrice par abilities, identique pour les politiques et les services', function () {
    $expected = [
        'moderator' => [Permissions::MEDIA_MODERATE, Permissions::REPORTS_REVIEW, Permissions::APPEALS_REVIEW, Permissions::VERIFICATIONS_REVIEW, Permissions::SELFIE_VIEW],
        'support' => [Permissions::TICKETS_MANAGE, Permissions::USERS_VIEW],
    ];
    $all = [Permissions::MEDIA_MODERATE, Permissions::REPORTS_REVIEW, Permissions::APPEALS_REVIEW, Permissions::VERIFICATIONS_REVIEW, Permissions::SELFIE_VIEW,
        Permissions::USERS_VIEW, Permissions::USERS_MANAGE, Permissions::CREDITS_ADJUST, Permissions::PREMIUM_GRANT, Permissions::TICKETS_MANAGE, Permissions::AUDIT_VIEW];

    foreach ($all as $ability) {
        expect(Permissions::can(Seed::staff('admin'), $ability))->toBeTrue($ability);
        foreach (['moderator', 'support'] as $role) {
            expect(Permissions::can(Seed::staff($role), $ability))->toBe(in_array($ability, $expected[$role], true), "{$role} / {$ability}");
        }
    }
    expect(Permissions::can(null, Permissions::TICKETS_MANAGE))->toBeFalse();
});

it('un compte désactivé n’a plus aucun droit, même sur les services', function () {
    $mod = Seed::staff('moderator');
    $m = Seed::media(Seed::user()->id);
    DB::table('staff_users')->where('id', $mod->id)->update(['is_active' => false]);

    expect(Permissions::can($mod->fresh(), Permissions::MEDIA_MODERATE))->toBeFalse();
    expect(fn () => app(\App\Services\Admin\MediaModeration::class)->approve($mod->fresh(), $m))->toThrow(\Illuminate\Auth\Access\AuthorizationException::class);
});

it('le support ne peut agir sur aucune file de modération ni sur les sanctions via les services', function () {
    $support = Seed::staff('support');
    $u = Seed::user();
    $r = Seed::report($u->id);
    [$ver] = Seed::verification(Seed::user('Vera')->id);
    $appeal = Seed::appeal(Seed::sanction($u->id, 'warning'), $u->id);
    $denied = \Illuminate\Auth\Access\AuthorizationException::class;

    expect(fn () => app(\App\Services\Admin\ReportModeration::class)->decide($support, $r, 'ban', 'motif correct'))->toThrow($denied);
    expect(fn () => app(\App\Services\Admin\AppealReview::class)->accept($support, $appeal))->toThrow($denied);
    expect(fn () => app(\App\Services\Admin\VerificationReview::class)->viewSelfie($support, $ver))->toThrow($denied);
    expect(fn () => app(\App\Services\Admin\VerificationReview::class)->approve($support, $ver))->toThrow($denied);
    expect(DB::table('reports')->find($r)->status)->toBe('open')->and(Seed::auditCount())->toBe(0);
});

it('le modérateur ne peut pas traiter les tickets', function () {
    $mod = Seed::staff('moderator');
    $t = Seed::ticket(Seed::user()->id);

    expect(fn () => app(\App\Services\Admin\TicketDesk::class)->update($mod, $t, 'closed', null))->toThrow(\Illuminate\Auth\Access\AuthorizationException::class);
});

it('le tableau de bord ne montre à chaque rôle que ses indicateurs', function () {
    $u = Seed::user();
    Seed::report($u->id);

    $mod = app(DashboardStats::class)->for(Seed::staff('moderator'));
    $support = app(DashboardStats::class)->for(Seed::staff('support'));
    $admin = app(DashboardStats::class)->for(Seed::staff('admin'));

    expect(array_keys($mod))->toEqualCanonicalizing(['reports_open', 'media_pending', 'verifications_pending', 'appeals_open']);
    expect(array_keys($support))->toEqualCanonicalizing(['signups_7d', 'signups_series', 'active_24h', 'active_7d', 'tickets_open']);
    expect(array_keys($admin))->toEqualCanonicalizing(['signups_7d', 'signups_series', 'active_24h', 'active_7d', 'reports_open', 'media_pending', 'verifications_pending', 'appeals_open', 'tickets_open']);
});

it('calcule les indicateurs du tableau de bord', function () {
    $old = Seed::user('Old');
    DB::table('users')->where('id', $old->id)->update(['created_at' => now()->subDays(20), 'last_seen_at' => now()->subDays(10)]);
    $a = Seed::user('Recent');
    DB::table('users')->where('id', $a->id)->update(['last_seen_at' => now()->subHours(2)]);
    $b = Seed::user('Week');
    DB::table('users')->where('id', $b->id)->update(['created_at' => now()->subDays(3), 'last_seen_at' => now()->subDays(3)]);

    Seed::report($a->id, 'harassment', 0, $b->id);
    Seed::report($a->id, 'harassment', 1, $b->id);
    Seed::report($a->id, 'minor_suspected', 2, $b->id);
    Seed::report($a->id, 'other', 2, $b->id);
    DB::table('reports')->whereRaw("reason = 'other'")->update(['status' => 'dismissed']);
    Seed::media($a->id);
    Seed::media($a->id, 'profile_photo', 'approved');
    Seed::verification($b->id);
    Seed::appeal(Seed::sanction($a->id, 'ban'), $a->id);
    Seed::ticket($a->id);
    Seed::ticket($a->id, 'closed');

    $s = app(DashboardStats::class)->for(Seed::staff('admin'));

    expect($s['signups_7d'])->toBe(2) // Recent et Week ; Old date de 20 jours
        ->and($s['active_24h'])->toBe(1)
        ->and($s['active_7d'])->toBe(2)
        ->and($s['reports_open'])->toBe([0 => 1, 1 => 1, 2 => 1])
        ->and($s['media_pending'])->toBe(1)
        ->and($s['verifications_pending'])->toBe(1)
        ->and($s['appeals_open'])->toBe(1)
        ->and($s['tickets_open'])->toBe(1)
        ->and(array_sum($s['signups_series']))->toBe($s['signups_7d'])->and($s['signups_series'])->toHaveCount(7);
});

it('affiche le tableau de bord (widget) sans erreur pour chaque rôle', function () {
    foreach (['moderator', 'support', 'admin'] as $role) {
        $this->actingAs(Seed::staff($role), 'staff');
        Livewire::test(AdminStatsWidget::class)->assertSuccessful();
    }
    $this->actingAs(Seed::staff('moderator'), 'staff');
    Livewire::test(AdminStatsWidget::class)->assertSee('Médias en attente')->assertDontSee('Tickets à traiter')->assertDontSee('Inscriptions');
});

it('ne reconnaît que les rôles du schéma', function () {
    expect(StaffUser::ROLES)->toBe(['moderator', 'support', 'admin']);
    expect(fn () => DB::transaction(fn () => DB::table('staff_users')->insert(['id' => (string) Str::uuid(), 'email' => 'x@y.test', 'password' => 'x', 'role' => 'root'])))->toThrow(\Illuminate\Database\QueryException::class);
});
