<?php

use App\Filament\Models\MediaItem;
use App\Filament\Models\Member;
use App\Filament\Models\Report;
use App\Filament\Models\VerificationRequest;
use App\Filament\Resources\MediaItemResource\Pages\ListMediaItems;
use App\Filament\Resources\MemberResource\Pages\ListMembers;
use App\Filament\Resources\MemberResource\Pages\ViewMember;
use App\Filament\Resources\ReportResource;
use App\Filament\Resources\ReportResource\Pages\ListReports;
use App\Filament\Resources\ReportResource\Pages\ViewReport;
use App\Filament\Resources\VerificationRequestResource\Pages\ListVerificationRequests;
use App\Filament\Resources\VerificationRequestResource\Pages\ViewVerificationRequest;
use App\Filament\Support\Labels;
use App\Filament\Support\Mask;
use App\Filament\Support\Sla;
use App\Filament\Widgets\AdminStatsWidget;
use App\Services\Admin\MediaModeration;
use App\Services\Admin\Permissions;
use App\Services\Storage\MediaStorage;
use Filament\Actions\Testing\TestAction;
use Filament\Facades\Filament;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Livewire\Livewire;
use Tests\Feature\Admin\Support\Seed;
use Tests\Support\FakeMediaStorage;

beforeEach(function () {
    Filament::setCurrentPanel('admin');
    $this->storage = new FakeMediaStorage;
    app()->instance(MediaStorage::class, $this->storage);
});

/** @return array<string, mixed> actions de ligne d'une table, par nom */
function rowActions(string $page): array
{
    return collect(Livewire::test($page)->instance()->getTable()->getActions())->keyBy(fn ($a) => $a->getName())->all();
}

// ---------- Libellés traduits et couleurs ----------

it('affiche des libellés français et des couleurs d’état, jamais les valeurs brutes', function () {
    $this->actingAs(Seed::staff('moderator'), 'staff');
    $u = Seed::user('Awa');
    $r = Seed::report($u->id, 'harassment', 2);

    Livewire::test(ListReports::class)
        ->assertCanSeeTableRecords([Report::find($r)])
        ->assertSeeText('Ouvert')->assertSeeText('Critique')->assertSeeText('Harcèlement')->assertSeeText('Actif')
        ->assertTableColumnFormattedStateSet('status', 'Ouvert', Report::find($r))
        ->assertTableColumnFormattedStateSet('reported.status', 'Actif', Report::find($r))
        ->assertTableColumnFormattedStateSet('priority', 'Critique', Report::find($r));

    expect(Labels::color('report', 'open'))->toBe('warning')->and(Labels::color('account', 'banned'))->toBe('danger')
        ->and(Labels::color('account', 'active'))->toBe('success')->and(Labels::color('priority', 2))->toBe('danger')
        ->and(Labels::text('audit', 'media.preview'))->toBe('Aperçu de média')
        // Valeur inconnue : affichée telle quelle, sans perte d’information.
        ->and(Labels::text('audit', 'test.action'))->toBe('test.action');
});

it('suit la langue du back-office (app.admin_locale) : français par défaut, anglais à la demande, français si inconnue', function () {
    $this->actingAs(Seed::staff('moderator'), 'staff');
    $u = Seed::user('Awa');
    $r = Seed::report($u->id, 'harassment', 2);

    expect(\App\Filament\Support\Staff::t('admin.action.ban'))->toBe('Bannir');
    config(['app.admin_locale' => 'en']);
    Livewire::test(ListReports::class)->assertTableColumnFormattedStateSet('status', 'Open', Report::find($r))
        ->assertTableColumnFormattedStateSet('priority', 'Critical', Report::find($r));
    expect(\App\Filament\Support\Staff::t('admin.action.ban'))->toBe('Ban');

    config(['app.admin_locale' => 'de']);
    expect(\App\Filament\Support\Staff::t('admin.action.ban'))->toBe('Bannir');
});

it('a les mêmes clés en français et en anglais, et toutes les clés utilisées existent', function () {
    $flat = function (array $a, string $p = '') use (&$flat): array {
        $out = [];
        foreach ($a as $k => $v) {
            is_array($v) ? $out += $flat($v, $p.$k.'.') : $out[$p.$k] = $v;
        }

        return $out;
    };
    $fr = $flat(require base_path('lang/fr/admin.php'));
    $en = $flat(require base_path('lang/en/admin.php'));
    expect(array_keys($fr))->toEqualCanonicalizing(array_keys($en));

    $used = [];
    foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator(app_path('Filament'), FilesystemIterator::SKIP_DOTS)) as $file) {
        if ($file->getExtension() === 'php' && ! str_contains($file->getPathname(), 'Commands')) {
            preg_match_all("/'admin\\.([a-z_0-9.]+[a-z_0-9])'/", file_get_contents($file->getPathname()), $m);
            $used = [...$used, ...$m[1]];
        }
    }
    // « admin.cap_exceeded » est une valeur d’audit (clé courte), pas une clé de langue : on ne vérifie que les clés complètes de lang.
    $missing = collect($used)->unique()->reject(fn (string $k) => array_key_exists($k, $fr) || $k === 'cap_exceeded')->values()->all();
    expect($missing)->toBe([]);
});

it('ne laisse aucune chaîne française codée en dur dans les libellés du back-office', function () {
    foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator(app_path('Filament'), FilesystemIterator::SKIP_DOTS)) as $file) {
        if ($file->getExtension() !== 'php' || str_contains($file->getPathname(), 'Commands')) {
            continue;
        }
        $code = preg_replace(['~/\*.*?\*/~s', '~^\s*//.*$~m'], '', file_get_contents($file->getPathname()));
        preg_match_all("/(?:label|placeholder|heading|description|title|Heading|Description|Label|Placeholder|Section::make)\\(\\s*'([^']*[éèêàçùôîÉ][^']*)'/", $code, $m);
        expect($m[1])->toBe([], $file->getPathname());
    }
});

// ---------- Délais (SLA) ----------

it('calcule les délais 24 h / 2 h et leur niveau (ok, 75 %, dépassé)', function () {
    $mk = fn (string $reason, int $priority, $at, string $status = 'open') => (new Report)->forceFill(['reason' => $reason, 'priority' => $priority, 'status' => $status, 'created_at' => $at]);

    expect(Sla::hours($mk('harassment', 0, now())))->toBe(24)->and(Sla::hours($mk('minor_suspected', 2, now())))->toBe(2);
    expect(Sla::level($mk('harassment', 0, now()->subHours(2))))->toBe('ok')
        ->and(Sla::level($mk('harassment', 0, now()->subHours(19))))->toBe('warning')
        ->and(Sla::level($mk('harassment', 0, now()->subHours(25))))->toBe('overdue')
        ->and(Sla::level($mk('minor_suspected', 2, now()->subMinutes(100))))->toBe('warning')
        ->and(Sla::level($mk('minor_suspected', 2, now()->subHours(3))))->toBe('overdue')
        ->and(Sla::level($mk('harassment', 0, now()->subHours(50), 'actioned')))->toBeNull()
        ->and(Sla::color($mk('minor_suspected', 2, now()->subHours(3))))->toBe('danger');
});

it('montre le délai relatif et un badge « en retard » dans la file, et filtre les retards', function () {
    $this->actingAs(Seed::staff('moderator'), 'staff');
    $u = Seed::user('Awa');
    $late = Seed::report($u->id, 'harassment', 0, null, now()->subHours(30));
    $minorLate = Seed::report($u->id, 'minor_suspected', 2, null, now()->subHours(3));
    $fresh = Seed::report($u->id, 'other', 0, null, now()->subHour());

    $page = Livewire::test(ListReports::class)
        ->assertTableColumnFormattedStateSet('sla', Sla::text(Report::find($late)), Report::find($late))
        ->assertTableColumnStateSet('sla', Sla::text(Report::find($fresh)), Report::find($fresh));
    expect(Sla::text(Report::find($late)))->toStartWith('en retard')->and(Sla::text(Report::find($fresh)))->toStartWith('dans');
    $page->assertSeeText('en retard');

    Livewire::test(ListReports::class)->filterTable('overdue', true)
        ->assertCanSeeTableRecords([Report::find($late), Report::find($minorLate)])->assertCanNotSeeTableRecords([Report::find($fresh)]);
});

it('colore le badge de navigation en rouge s’il existe un signalement critique ouvert', function () {
    $this->actingAs(Seed::staff('moderator'), 'staff');
    $u = Seed::user('Awa');
    Seed::report($u->id, 'harassment', 0);
    expect(ReportResource::getNavigationBadgeColor())->toBe('warning');
    Seed::report($u->id, 'minor_suspected', 2);
    expect(ReportResource::getNavigationBadgeColor())->toBe('danger');
});

// ---------- File : ordre, filtres, enchaînement ----------

it('ordonne la file par priorité puis du plus ancien au plus récent, avec filtres', function () {
    $this->actingAs(Seed::staff('moderator'), 'staff');
    $u = Seed::user('Awa');
    $newNormal = Seed::report($u->id, 'other', 0, null, now()->subHour());
    $oldNormal = Seed::report($u->id, 'other', 0, null, now()->subHours(10));
    $critical = Seed::report($u->id, 'minor_suspected', 2, null, now()->subMinutes(5));
    $money = Seed::report($u->id, 'money_request', 1, null, now()->subHours(2));

    Livewire::test(ListReports::class)
        ->assertCanSeeTableRecords([Report::find($critical), Report::find($money), Report::find($oldNormal), Report::find($newNormal)], inOrder: true);
    Livewire::test(ListReports::class)->filterTable('reason', 'money_request')
        ->assertCanSeeTableRecords([Report::find($money)])->assertCanNotSeeTableRecords([Report::find($critical), Report::find($oldNormal)]);
    Livewire::test(ListReports::class)->filterTable('priority', 0)
        ->assertCanSeeTableRecords([Report::find($oldNormal), Report::find($newNormal)], inOrder: true)->assertCanNotSeeTableRecords([Report::find($critical)]);
});

it('enchaîne : après une décision, ouvre le plus ancien signalement ouvert du même niveau', function () {
    $this->actingAs(Seed::staff('moderator'), 'staff');
    $u = Seed::user('Awa');
    $current = Seed::report($u->id, 'other', 0, null, now()->subHours(5));
    $newer = Seed::report($u->id, 'other', 0, null, now()->subHours(1));
    $oldest = Seed::report($u->id, 'other', 0, null, now()->subHours(9));
    $otherLevel = Seed::report($u->id, 'money_request', 1, null, now()->subHours(20));

    expect(ReportResource::nextUrl(Report::find($current)))->toBe(ReportResource::getUrl('view', ['record' => $oldest]));
    Livewire::test(ViewReport::class, ['record' => $current])->callAction('dismiss', data: ['note' => 'Rien d’anormal.'])
        ->assertRedirect(ReportResource::getUrl('view', ['record' => $oldest]));
    // Plus aucun autre au même niveau que $oldest/$newer : on passe de l’un à l’autre, puis retour à la liste.
    Livewire::test(ViewReport::class, ['record' => $oldest])->callAction('dismiss', data: ['note' => 'Rien d’anormal.'])
        ->assertRedirect(ReportResource::getUrl('view', ['record' => $newer]));
    Livewire::test(ViewReport::class, ['record' => $newer])->callAction('dismiss', data: ['note' => 'Rien d’anormal.'])
        ->assertRedirect(ReportResource::getUrl('index'));
    expect(DB::table('reports')->find($otherLevel)->status)->toBe('open');
});

// ---------- Fiche de signalement : contexte ----------

it('donne le contexte sur la fiche : compte signalé, crédibilité du signalant, sanctions antérieures, doublons, délai', function () {
    $this->actingAs(Seed::staff('moderator'), 'staff');
    $target = Seed::user('Cible Awa');
    $reporter = Seed::user('Signalant Bob');
    Seed::sanction($target->id, 'warning', null, 'Premier rappel');
    $old = Seed::report($target->id, 'harassment', 0, $reporter->id, now()->subDays(3));
    DB::table('reports')->where('id', $old)->update(['status' => 'dismissed']);
    $r = Seed::report($target->id, 'harassment', 0, $reporter->id, now()->subHours(30));
    Seed::report($target->id, 'other', 0);

    Livewire::test(ViewReport::class, ['record' => $r])
        ->assertSee('Cible Awa')->assertSee('Signalant Bob')
        ->assertSee('Avertissement')->assertSee('Premier rappel')
        ->assertSee('2 signalement(s) déposé(s) : 0 suivi(s) de sanction, 1 classé(s) sans suite.')
        ->assertSee('en retard')
        ->assertSee('Signalements ouverts sur ce compte');
});

it('n’expose aucun extrait de conversation : aucun rôle ne peut lire les messages', function () {
    foreach (['moderator', 'support', 'admin'] as $role) {
        expect(collect(Permissions::for($role))->filter(fn (string $p) => str_contains($p, 'message') || str_contains($p, 'conversation')))->toBeEmpty();
    }
    $this->actingAs(Seed::staff('moderator'), 'staff');
    $u = Seed::user('Awa');
    $r = Seed::report($u->id, 'harassment');
    DB::table('reports')->where('id', $r)->update(['context_type' => 'conversation', 'context_id' => (string) Illuminate\Support\Str::uuid()]);

    Livewire::test(ViewReport::class, ['record' => $r])->assertSee('Conversation')->assertSee('aucun rôle du personnel n\'a le droit de lire les messages');
});

it('ne lie la fiche du compte signalé qu’au rôle qui peut consulter les comptes', function () {
    $u = Seed::user('Awa');
    $r = Seed::report($u->id, 'harassment');

    $this->actingAs(Seed::staff('moderator'), 'staff');
    Livewire::test(ViewReport::class, ['record' => $r])->assertDontSeeHtml('/users/'.$u->id);
    $this->actingAs(Seed::staff('admin'), 'staff');
    Livewire::test(ViewReport::class, ['record' => $r])->assertSeeHtml('/users/'.$u->id);
});

// ---------- Confirmations ----------

it('exige une confirmation qui nomme le compte et la conséquence pour chaque décision sur un signalement', function () {
    $this->actingAs(Seed::staff('moderator'), 'staff');
    $u = Seed::user('Awa Diallo');
    $r = Seed::report($u->id, 'harassment');

    $page = Livewire::test(ViewReport::class, ['record' => $r]);
    foreach (['warn', 'suspend', 'ban', 'dismiss'] as $name) {
        $action = collect($page->instance()->getCachedHeaderActions())->first(fn ($a) => $a->getName() === $name);
        expect($action->isConfirmationRequired())->toBeTrue($name);
    }
    $page->mountAction('ban')->assertMountedActionModalSee(['Awa Diallo', 'sera banni']);
    Livewire::test(ViewReport::class, ['record' => $r])->mountAction('suspend')->assertMountedActionModalSee(['Awa Diallo', 'sera suspendu']);
    Livewire::test(ViewReport::class, ['record' => $r])->mountAction('suspend')->setActionData(['days' => 7])->assertMountedActionModalSee('pendant 7 jour(s)');
});

it('demande confirmation pour rejeter un média (le fichier est supprimé) mais plus pour l’approuver', function () {
    $this->actingAs(Seed::staff('moderator'), 'staff');
    $u = Seed::user('Awa');
    $m = Seed::media($u->id);

    $actions = rowActions(ListMediaItems::class);
    expect($actions['reject']->isConfirmationRequired())->toBeTrue()->and($actions['approve']->isConfirmationRequired())->toBeFalse();
    Livewire::test(ListMediaItems::class)->mountAction(TestAction::make('reject')->table(MediaItem::find($m)))
        ->assertMountedActionModalSee(['supprimé du stockage', 'irréversible']);
});

it('demande confirmation pour rejeter une vérification et dit que le selfie sera supprimé', function () {
    $this->actingAs(Seed::staff('moderator'), 'staff');
    $u = Seed::user('Awa');
    [$v] = Seed::verification($u->id);

    $page = Livewire::test(ViewVerificationRequest::class, ['record' => $v]);
    $reject = collect($page->instance()->getCachedHeaderActions())->first(fn ($a) => $a->getName() === 'reject');
    expect($reject->isConfirmationRequired())->toBeTrue();
    $page->mountAction('reject')->assertMountedActionModalSee(['supprimé définitivement', 'irréversible']);
    // Rejeter sans passer la confirmation ni le motif ne supprime rien.
    expect(DB::table('verification_requests')->find($v)->status)->toBe('pending')->and($this->storage->deleted)->toBe([]);
});

it('demande confirmation sur les sanctions de la fiche utilisateur (admin)', function () {
    $this->actingAs(Seed::staff('admin'), 'staff');
    $u = Seed::user('Awa Diallo');

    $page = Livewire::test(ViewMember::class, ['record' => $u->id]);
    foreach (['suspend', 'ban'] as $name) {
        $action = collect($page->instance()->getCachedHeaderActions())->first(fn ($a) => $a->getName() === $name);
        expect($action->isConfirmationRequired())->toBeTrue($name);
    }
    $page->mountAction('ban')->assertMountedActionModalSee(['Awa Diallo', 'sera banni']);
});

// ---------- Masquage des e-mails ----------

it('masque l’e-mail (a***@e***.com)', function () {
    expect(Mask::email('awa.diallo@example.com'))->toBe('a***@e***.com')
        ->and(Mask::email('x@y.co.uk'))->toBe('x***@y***.uk')
        ->and(Mask::email('sans-arobase'))->toBe('***')
        ->and(Mask::email(null))->toBeNull()->and(Mask::email(''))->toBeNull();
});

it('masque les e-mails en liste pour le support et ne les montre en entier que sur la fiche (users.view)', function () {
    $u = Seed::user('Awa Diallo');
    $this->actingAs(Seed::staff('support'), 'staff');

    Livewire::test(ListMembers::class)->assertSee(Mask::email($u->email))->assertDontSee($u->email);
    // Recherche inchangée : elle porte sur la vraie valeur.
    Livewire::test(ListMembers::class)->searchTable($u->email)->assertCanSeeTableRecords([Member::find($u->id)]);
    Livewire::test(\App\Filament\Resources\MemberResource\Pages\ViewMember::class, ['record' => $u->id])->assertSee($u->email);
});

it('masque l’e-mail du déposant dans la file média pour l’admin, et le cache au modérateur', function () {
    $u = Seed::user('Awa');
    $m = Seed::media($u->id);

    $this->actingAs(Seed::staff('admin'), 'staff');
    Livewire::test(ListMediaItems::class)->assertSee(Mask::email($u->email))->assertDontSee($u->email);
    $this->actingAs(Seed::staff('moderator'), 'staff');
    Livewire::test(ListMediaItems::class)->assertCanSeeTableRecords([MediaItem::find($m)])->assertDontSee($u->email)->assertDontSee(Mask::email($u->email));
});

// ---------- Aperçu média en fenêtre modale ----------

it('ouvre l’aperçu dans une fenêtre modale, via le chemin audité, sans nouvel onglet', function () {
    $this->actingAs(Seed::staff('moderator'), 'staff');
    $u = Seed::user('Awa');
    $m = Seed::media($u->id, 'profile_photo', 'processing', 'u/x/p.jpg');

    $actions = rowActions(ListMediaItems::class);
    expect($actions['preview']->getUrl())->toBeNull()->and($actions['preview']->shouldOpenUrlInNewTab())->toBeFalse();
    expect(Seed::auditCount('media.preview'))->toBe(0);

    $page = Livewire::test(ListMediaItems::class)->mountAction(TestAction::make('preview')->table(MediaItem::find($m)));
    expect(Seed::auditCount('media.preview'))->toBe(1);
    $audit = json_decode(Seed::audit('media.preview')->after, true);
    expect($audit)->not->toHaveKey('url');
    $page->assertMountedActionModalSee(['Afficher'])->assertMountedActionModalSeeHtml('<img');
    expect($page->get('previewUrl'))->toBeString()->and($page->get('previewUrl'))->toContain('p.jpg');
    // Floutée tant qu’on n’a pas cliqué « Afficher ».
    $page->assertMountedActionModalSeeHtml('filter:blur');
});

it('refuse l’aperçu au support et ne produit aucune URL ni ligne d’audit', function () {
    $u = Seed::user('Awa');
    $m = Seed::media($u->id);
    $support = Seed::staff('support');

    expect(fn () => app(MediaModeration::class)->preview($support, $m))->toThrow(AuthorizationException::class);
    expect(Seed::auditCount('media.preview'))->toBe(0);
});

// ---------- Tableau de bord ----------

it('fait pointer les tuiles du tableau de bord vers la file filtrée', function () {
    $this->actingAs(Seed::staff('moderator'), 'staff');
    $u = Seed::user('Awa');
    Seed::report($u->id, 'minor_suspected', 2);
    Seed::media($u->id);

    $html = Livewire::test(AdminStatsWidget::class)->assertSee('Signalements critiques')->assertSee('Médias en attente')->html();
    expect($html)->toContain('/admin/reports?')->and($html)->toContain('/admin/media-queue');
    expect(urldecode($html))->toContain('filters[priority][value]=2');
});

// ---------- Invariants de droits intacts ----------

it('ne modifie pas la matrice des droits ni la politique du selfie', function () {
    expect(Permissions::violations())->toBe([]);
    expect(Permissions::for('support'))->toEqualCanonicalizing([Permissions::TICKETS_MANAGE, Permissions::USERS_VIEW])
        ->and(Permissions::for('moderator'))->not->toContain(Permissions::USERS_VIEW)
        ->and(Permissions::for('moderator'))->toContain(Permissions::SELFIE_VIEW);
    expect(Permissions::violations([\App\Models\StaffUser::ROLE_SUPPORT => [Permissions::VERIFICATIONS_REVIEW]], []))->not->toBe([]);
});

it('garde les files fermées aux rôles sans droit : le support ne voit ni signalements ni médias ni vérifications', function () {
    $this->actingAs(Seed::staff('support'), 'staff');
    expect(ReportResource::canViewAny())->toBeFalse()
        ->and(\App\Filament\Resources\MediaItemResource::canViewAny())->toBeFalse()
        ->and(\App\Filament\Resources\VerificationRequestResource::canViewAny())->toBeFalse();
    $this->get('/admin/reports')->assertForbidden();
});

it('garde le selfie hors de la liste des vérifications, même avec les libellés traduits', function () {
    $this->actingAs(Seed::staff('moderator'), 'staff');
    $u = Seed::user('Awa');
    [$v] = Seed::verification($u->id);

    Livewire::test(ListVerificationRequests::class)->assertCanSeeTableRecords([VerificationRequest::find($v)])
        ->assertTableColumnFormattedStateSet('status', 'En attente', VerificationRequest::find($v))
        ->assertDontSee('selfie.jpg')->assertDontSeeHtml('<img');
});
