<?php

// File des signalements : attribution (« Prendre ») avec verrou, puis traitement groupé des doublons d'un même compte.
// - un signalement pris par une personne ne peut être décidé que par elle (le verrou expire au bout de `admin.assignment_ttl_minutes`) ;
// - l'administrateur peut le reprendre ; toute prise, libération ou reprise est tracée ;
// - une décision peut s'appliquer aussi aux autres signalements ouverts du même motif sur le même compte (jamais « mineur suspecté »).

use App\Filament\Models\Report;
use App\Filament\Resources\ReportResource\Pages\ListReports;
use App\Services\Admin\ReportAssignment;
use App\Services\Admin\ReportModeration;
use Filament\Facades\Filament;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Livewire\Livewire;
use Tests\Feature\Admin\Support\Seed;

beforeEach(function () {
    Filament::setCurrentPanel('admin');
    $this->mod = Seed::staff('moderator');
    $this->other = Seed::staff('moderator');
    $this->admin = Seed::staff('admin');
    $this->assign = app(ReportAssignment::class);
    $this->moderation = app(ReportModeration::class);
});

function ra_row(string $id): object
{
    return DB::table('reports')->find($id);
}

// ---------- attribution ----------

it('prend un signalement : attribué, horodaté, tracé', function () {
    $r = Seed::report(Seed::user()->id);

    $this->assign->claim($this->mod, $r);

    $row = ra_row($r);
    expect($row->assigned_to)->toBe($this->mod->id)->and($row->assigned_at)->not->toBeNull();
    $audit = Seed::audit('report.claim');
    expect($audit->actor_staff_id)->toBe($this->mod->id)->and($audit->subject_id)->toBe($r);
});

it('refuse de prendre un signalement pris par une autre personne, tant que le verrou n’a pas expiré', function () {
    $r = Seed::report(Seed::user()->id);
    $this->assign->claim($this->mod, $r);

    expect(fn () => $this->assign->claim($this->other, $r))->toThrow(DomainException::class);
    expect(ra_row($r)->assigned_to)->toBe($this->mod->id);

    DB::table('reports')->where('id', $r)->update(['assigned_at' => now()->subMinutes(config('admin.assignment_ttl_minutes') + 1)]);
    $this->assign->claim($this->other, $r);
    expect(ra_row($r)->assigned_to)->toBe($this->other->id);
});

it('reprendre son propre signalement renouvelle le verrou', function () {
    $r = Seed::report(Seed::user()->id);
    $this->assign->claim($this->mod, $r);
    DB::table('reports')->where('id', $r)->update(['assigned_at' => now()->subMinutes(30)]);

    $this->assign->claim($this->mod, $r);

    expect(strtotime(ra_row($r)->assigned_at))->toBeGreaterThan(time() - 60);
});

it('ne prend pas un signalement déjà traité', function () {
    $r = Seed::report(Seed::user()->id);
    DB::table('reports')->where('id', $r)->update(['status' => 'dismissed']);

    expect(fn () => $this->assign->claim($this->mod, $r))->toThrow(DomainException::class);
});

it('libère : la personne qui l’a pris ou l’administrateur, pas une autre', function () {
    $r = Seed::report(Seed::user()->id);
    $this->assign->claim($this->mod, $r);

    expect(fn () => $this->assign->release($this->other, $r))->toThrow(DomainException::class);
    expect(ra_row($r)->assigned_to)->toBe($this->mod->id);

    $this->assign->release($this->mod, $r);
    expect(ra_row($r)->assigned_to)->toBeNull()->and(ra_row($r)->assigned_at)->toBeNull();
    expect(Seed::audit('report.release')->actor_staff_id)->toBe($this->mod->id);

    $this->assign->claim($this->mod, $r);
    $this->assign->release($this->admin, $r);
    expect(ra_row($r)->assigned_to)->toBeNull();
});

it('l’administrateur reprend un signalement pris ; un modérateur ne le peut pas', function () {
    $r = Seed::report(Seed::user()->id);
    $this->assign->claim($this->mod, $r);

    expect(fn () => $this->assign->claim($this->other, $r, force: true))->toThrow(AuthorizationException::class);
    expect(ra_row($r)->assigned_to)->toBe($this->mod->id);

    $this->assign->claim($this->admin, $r, force: true);
    expect(ra_row($r)->assigned_to)->toBe($this->admin->id);
    $audit = Seed::audit('report.takeover');
    expect($audit->actor_staff_id)->toBe($this->admin->id)->and(json_decode($audit->before, true)['assigned_to'])->toBe($this->mod->id);
});

it('le soutien ne peut ni prendre ni libérer (aucun droit de revue)', function () {
    $r = Seed::report(Seed::user()->id);
    $support = Seed::staff('support');

    expect(fn () => $this->assign->claim($support, $r))->toThrow(AuthorizationException::class);
});

// ---------- verrou sur la décision ----------

it('seule la personne qui a pris le signalement peut le décider ; la décision lève l’attribution', function () {
    $r = Seed::report(Seed::user()->id);
    $this->assign->claim($this->mod, $r);

    expect(fn () => $this->moderation->decide($this->other, $r, 'dismiss', 'Rien à signaler'))->toThrow(DomainException::class);
    expect(ra_row($r)->status)->toBe('open');

    $this->moderation->decide($this->mod, $r, 'dismiss', 'Rien à signaler');
    $row = ra_row($r);
    expect($row->status)->toBe('dismissed')->and($row->assigned_to)->toBeNull()->and($row->assigned_at)->toBeNull();
});

it('un verrou expiré, un signalement libre ou pris par soi ne bloquent pas la décision', function () {
    $free = Seed::report(Seed::user()->id);
    $this->moderation->decide($this->other, $free, 'dismiss', 'Libre');
    expect(ra_row($free)->status)->toBe('dismissed');

    $expired = Seed::report(Seed::user()->id);
    $this->assign->claim($this->mod, $expired);
    DB::table('reports')->where('id', $expired)->update(['assigned_at' => now()->subMinutes(config('admin.assignment_ttl_minutes') + 5)]);
    $this->moderation->decide($this->other, $expired, 'dismiss', 'Verrou expiré');
    expect(ra_row($expired)->status)->toBe('dismissed');
});

// ---------- interface ----------

it('la liste propose « Prendre » et « Libérer », affiche qui l’a pris et filtre « Mes signalements »', function () {
    $mine = Seed::report(Seed::user('Cible A')->id);
    $theirs = Seed::report(Seed::user('Cible B')->id);
    $free = Seed::report(Seed::user('Cible C')->id);
    $this->assign->claim($this->other, $theirs);
    $this->actingAs($this->mod, 'staff');

    $page = Livewire::test(ListReports::class)
        ->callTableAction('claim', Report::find($mine))
        ->assertHasNoTableActionErrors();
    expect(ra_row($mine)->assigned_to)->toBe($this->mod->id);

    $page->assertTableActionVisible('release', Report::find($mine))
        ->assertTableActionHidden('claim', Report::find($mine))
        ->assertTableActionHidden('claim', Report::find($theirs))
        ->assertTableActionHidden('warn', Report::find($theirs))
        ->assertTableActionVisible('warn', Report::find($free))
        ->filterTable('mine')
        ->assertCanSeeTableRecords([Report::find($mine)])
        ->assertCanNotSeeTableRecords([Report::find($theirs), Report::find($free)]);
});

it('l’administrateur voit « Reprendre » sur un signalement pris par une autre personne', function () {
    $r = Seed::report(Seed::user()->id);
    $this->assign->claim($this->mod, $r);
    $this->actingAs($this->admin, 'staff');

    Livewire::test(ListReports::class)
        ->assertTableActionVisible('take_over', Report::find($r))
        ->callTableAction('take_over', Report::find($r));

    expect(ra_row($r)->assigned_to)->toBe($this->admin->id);
});

// ---------- doublons ----------

it('décide aussi les signalements ouverts du même motif sur le même compte, avec une seule sanction', function () {
    $target = Seed::user('Cible');
    $main = Seed::report($target->id, 'harassment');
    $dupA = Seed::report($target->id, 'harassment');
    $dupB = Seed::report($target->id, 'harassment');
    $otherReason = Seed::report($target->id, 'fake_or_spam');
    $otherTarget = Seed::report(Seed::user('Autre')->id, 'harassment');

    $this->moderation->decide($this->mod, $main, 'warning', 'Propos déplacés', null, withDuplicates: true);

    foreach ([$main, $dupA, $dupB] as $id) {
        $row = ra_row($id);
        expect($row->status)->toBe('actioned')->and($row->outcome)->toBe('warning')->and($row->reviewed_by)->toBe($this->mod->id);
    }
    expect(ra_row($otherReason)->status)->toBe('open')->and(ra_row($otherTarget)->status)->toBe('open');
    expect(DB::table('sanctions')->where('user_id', $target->id)->count())->toBe(1);
    $closed = json_decode(Seed::audit('report.warning')->after, true)['closed_duplicates'];
    expect($closed)->toEqualCanonicalizing([$dupA, $dupB]);
});

it('sans l’option, les doublons restent ouverts', function () {
    $target = Seed::user();
    $main = Seed::report($target->id, 'harassment');
    $dup = Seed::report($target->id, 'harassment');

    $this->moderation->decide($this->mod, $main, 'dismiss', 'Classé');

    expect(ra_row($dup)->status)->toBe('open');
});

it('un doublon pris par une autre personne n’est pas touché', function () {
    $target = Seed::user();
    $main = Seed::report($target->id, 'harassment');
    $locked = Seed::report($target->id, 'harassment');
    $free = Seed::report($target->id, 'harassment');
    $this->assign->claim($this->other, $locked);

    $this->moderation->decide($this->mod, $main, 'dismiss', 'Classé', null, withDuplicates: true);

    expect(ra_row($locked)->status)->toBe('open')->and(ra_row($locked)->assigned_to)->toBe($this->other->id)->and(ra_row($free)->status)->toBe('dismissed');
    expect(json_decode(Seed::audit('report.dismiss')->after, true)['closed_duplicates'])->toBe([$free]);
});

it('« mineur suspecté » n’est jamais traité en groupe : chaque signalement est revu à part', function () {
    $target = Seed::user();
    $main = Seed::minorReport($target->id);
    $dup = Seed::report($target->id, 'minor_suspected', 2);

    $this->moderation->decide($this->mod, $main, 'suspension', 'Mineur confirmé', 7, withDuplicates: true);

    expect(ra_row($main)->status)->toBe('actioned')->and(ra_row($dup)->status)->toBe('open');
});

it('l’action « Avertir » de la liste applique la décision aux doublons quand la case est cochée', function () {
    $target = Seed::user('Cible');
    $main = Seed::report($target->id, 'harassment');
    $dup = Seed::report($target->id, 'harassment');
    $this->actingAs($this->mod, 'staff');

    Livewire::test(ListReports::class)
        ->callTableAction('warn', Report::find($main), data: ['note' => 'Propos déplacés', 'with_duplicates' => true])
        ->assertHasNoTableActionErrors();

    expect(ra_row($main)->status)->toBe('actioned')->and(ra_row($dup)->status)->toBe('actioned');
});
