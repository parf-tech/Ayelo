<?php

use App\Filament\Resources\AppealResource\Pages\ListAppeals;
use App\Filament\Resources\MediaItemResource\Pages\ListMediaItems;
use App\Filament\Resources\ReportResource\Pages\ListReports;
use App\Filament\Resources\ReportResource\Pages\ViewReport;
use App\Services\Storage\MediaStorage;
use Filament\Facades\Filament;
use Illuminate\Support\Facades\DB;
use Livewire\Livewire;
use Tests\Feature\Admin\Support\Seed;
use Tests\Support\FakeMediaStorage;

beforeEach(function () {
    Filament::setCurrentPanel('admin');
    $this->storage = new FakeMediaStorage;
    app()->instance(MediaStorage::class, $this->storage);
    $this->mod = Seed::staff('moderator');
    $this->actingAs($this->mod, 'staff');
});

// ---------- Médias ----------

it('liste les médias à modérer, sans les selfies de vérification ni les médias déjà traités', function () {
    $u = Seed::user();
    $a = Seed::media($u->id);
    $b = Seed::media($u->id, 'profile_photo', 'approved');
    [, $selfie] = Seed::verification($u->id);

    Livewire::test(ListMediaItems::class)
        ->assertCanSeeTableRecords([DB::table('media')->find($a) ? \App\Filament\Models\MediaItem::find($a) : null])
        ->assertCanNotSeeTableRecords([\App\Filament\Models\MediaItem::find($b), \App\Filament\Models\MediaItem::find($selfie)]);
});

it('approuve un média : statut, moderated_by et audit', function () {
    $u = Seed::user();
    $m = Seed::media($u->id);

    Livewire::test(ListMediaItems::class)->callTableAction('approve', \App\Filament\Models\MediaItem::find($m));

    $row = DB::table('media')->find($m);
    expect($row->status)->toBe('approved')->and($row->moderated_by)->toBe($this->mod->id);
    $audit = Seed::audit('media.approved');
    expect($audit->actor_staff_id)->toBe($this->mod->id)->and($audit->subject_type)->toBe('media')->and($audit->subject_id)->toBe($m)
        ->and(json_decode($audit->before, true)['status'])->toBe('processing')->and(json_decode($audit->after, true)['status'])->toBe('approved');
    expect($this->storage->deleted)->toBe([]);
});

it('rejette un média : statut rejected, objet supprimé, moderated_by et audit', function () {
    $u = Seed::user();
    $m = Seed::media($u->id, 'profile_photo', 'processing', 'u/x/photo.jpg');
    $this->storage->simulateUpload('u/x/photo.jpg', 100, 'image/jpeg');

    Livewire::test(ListMediaItems::class)->callTableAction('reject', \App\Filament\Models\MediaItem::find($m), data: ['label' => 'nudity']);

    $row = DB::table('media')->find($m);
    expect($row->status)->toBe('rejected')->and($row->moderated_by)->toBe($this->mod->id)->and($row->moderation_label)->toBe('nudity');
    expect($this->storage->deleted)->toBe(['u/x/photo.jpg'])->and($this->storage->head('u/x/photo.jpg'))->toBeNull();
    expect(Seed::audit('media.rejected')->actor_staff_id)->toBe($this->mod->id);
});

it('donne un aperçu par URL signée', function () {
    $u = Seed::user();
    $m = Seed::media($u->id, 'profile_photo', 'processing', 'u/x/p.jpg');

    Livewire::test(ListMediaItems::class)->assertTableActionHasUrl('preview', 'https://storage.test/get/u/x/p.jpg?ttl=10', \App\Filament\Models\MediaItem::find($m));
});

it('refuse de traiter deux fois un média ou un selfie de vérification, sans audit', function () {
    $u = Seed::user();
    $m = Seed::media($u->id);
    [, $selfie] = Seed::verification($u->id);
    $svc = app(\App\Services\Admin\MediaModeration::class);

    $svc->approve($this->mod, $m);
    $before = Seed::auditCount();
    expect(fn () => $svc->approve($this->mod, $m))->toThrow(DomainException::class);
    expect(fn () => $svc->reject($this->mod, $selfie, 'other'))->toThrow(DomainException::class);
    expect(fn () => $svc->reject($this->mod, Seed::media($u->id), 'inconnu'))->toThrow(DomainException::class);
    expect(Seed::auditCount())->toBe($before);
});

// ---------- Signalements ----------

it('trie les signalements par priorité décroissante puis par date croissante', function () {
    $u = Seed::user();
    $old = Seed::report($u->id, 'other', 0, null, now()->subDays(3));
    $new = Seed::report($u->id, 'other', 0, null, now()->subDay());
    $high = Seed::report($u->id, 'harassment', 1, null, now()->subHour());
    $minor = Seed::report($u->id, 'minor_suspected', 2, null, now());

    Livewire::test(ListReports::class)->assertCanSeeTableRecords(
        array_map(fn ($id) => \App\Filament\Models\Report::find($id), [$minor, $high, $old, $new]), inOrder: true,
    );
});

it('avertit : sanction warning visible par l’API, rapport actioned, compte inchangé, audit', function () {
    $u = Seed::user();
    $r = Seed::report($u->id);

    Livewire::test(ListReports::class)->callTableAction('warn', \App\Filament\Models\Report::find($r), data: ['note' => 'Merci de rester respectueux.']);

    $report = DB::table('reports')->find($r);
    expect($report->status)->toBe('actioned')->and($report->outcome)->toBe('warning')->and($report->reviewed_by)->toBe($this->mod->id)->and($report->reviewed_at)->not->toBeNull();
    expect(DB::table('users')->find($u->id)->status)->toBe('active');
    $s = DB::table('sanctions')->where('report_id', $r)->first();
    expect($s->kind)->toBe('warning')->and($s->reason)->toBe('Merci de rester respectueux.')->and($s->created_by)->toBe($this->mod->id);
    expect(Seed::audit('report.warning')->subject_id)->toBe($r);

    // L'utilisateur voit la sanction dans l'API existante.
    $this->app['auth']->forgetGuards();
    $this->withHeader('Authorization', 'Bearer '.$u->createToken('t')->plainTextToken)->getJson('/api/v1/me/sanctions')
        ->assertOk()->assertJsonPath('data.0.kind', 'warning')->assertJsonPath('data.0.reason', 'Merci de rester respectueux.');
});

it('suspend pour une durée : compte suspendu, fin de sanction, sessions fermées', function () {
    $u = Seed::user();
    $u->createToken('mobile');
    $r = Seed::report($u->id);

    Livewire::test(ListReports::class)->callTableAction('suspend', \App\Filament\Models\Report::find($r), data: ['days' => 7, 'note' => 'Propos injurieux répétés.']);

    expect(DB::table('users')->find($u->id)->status)->toBe('suspended');
    $s = DB::table('sanctions')->where('report_id', $r)->first();
    expect($s->kind)->toBe('suspension')->and(\Illuminate\Support\Carbon::parse($s->ends_at)->diffInDays(now(), true))->toBeGreaterThan(6.9)->toBeLessThan(7.1);
    expect(DB::table('reports')->find($r)->outcome)->toBe('suspension');
    expect(DB::table('personal_access_tokens')->where('tokenable_id', $u->id)->count())->toBe(0);
    expect(json_decode(Seed::audit('report.suspension')->after, true))->toMatchArray(['days' => 7, 'user_status' => 'suspended']);
});

it('bannit : compte banni, sanction sans fin, audit', function () {
    $u = Seed::user();
    $r = Seed::report($u->id, 'money_request');

    Livewire::test(ListReports::class)->callTableAction('ban', \App\Filament\Models\Report::find($r), data: ['note' => 'Arnaque avérée.']);

    expect(DB::table('users')->find($u->id)->status)->toBe('banned');
    $s = DB::table('sanctions')->where('report_id', $r)->first();
    expect($s->kind)->toBe('ban')->and($s->ends_at)->toBeNull();
    expect(DB::table('reports')->find($r))->toMatchArray(['status' => 'actioned', 'outcome' => 'ban']);
    expect(Seed::audit('report.ban'))->not->toBeNull();
});

it('classe sans suite : outcome none, aucune sanction', function () {
    $u = Seed::user();
    $r = Seed::report($u->id);

    Livewire::test(ViewReport::class, ['record' => $r])->callAction('dismiss', data: ['note' => 'Rien d’anormal.']);

    expect(DB::table('reports')->find($r))->toMatchArray(['status' => 'dismissed', 'outcome' => 'none', 'reviewed_by' => $this->mod->id]);
    expect(DB::table('sanctions')->where('user_id', $u->id)->count())->toBe(0);
    expect(Seed::audit('report.dismiss')->subject_id)->toBe($r);
});

it('exige un motif et une durée valides', function () {
    $u = Seed::user();
    $r = Seed::report($u->id);
    $svc = app(\App\Services\Admin\ReportModeration::class);

    expect(fn () => $svc->decide($this->mod, $r, 'warning', ' '))->toThrow(DomainException::class);
    expect(fn () => $svc->decide($this->mod, $r, 'suspension', 'motif', null))->toThrow(DomainException::class);
    expect(fn () => $svc->decide($this->mod, $r, 'suspension', 'motif', 400))->toThrow(DomainException::class);
    expect(fn () => $svc->decide($this->mod, $r, 'inconnu', 'motif'))->toThrow(DomainException::class);
    expect(DB::table('reports')->find($r)->status)->toBe('open')->and(Seed::auditCount('report.warning'))->toBe(0);
});

it('mineur suspecté : lève la suspension préventive et réactive le compte', function () {
    $u = Seed::user('Teen');
    $r = Seed::minorReport($u->id);

    Livewire::test(ViewReport::class, ['record' => $r])->callAction('lift_preventive', data: ['note' => 'Pièce d’identité vérifiée : majeure.']);

    expect(DB::table('users')->find($u->id)->status)->toBe('active');
    expect(DB::table('sanctions')->where('report_id', $r)->value('ends_at'))->not->toBeNull();
    expect(DB::table('reports')->find($r))->toMatchArray(['status' => 'dismissed', 'outcome' => 'none', 'reviewed_by' => $this->mod->id]);
    expect(Seed::audit('report.lift_preventive')->subject_id)->toBe($r);
});

it('mineur suspecté : la lever n’est proposée que pour ce motif, et avertir/classer est refusé tant que la suspension est en vigueur', function () {
    $u = Seed::user();
    $other = Seed::report($u->id);
    $r = Seed::minorReport(Seed::user('Teen2')->id);
    $svc = app(\App\Services\Admin\ReportModeration::class);

    Livewire::test(ViewReport::class, ['record' => $other])->assertActionHidden('lift_preventive');
    Livewire::test(ViewReport::class, ['record' => $r])->assertActionVisible('lift_preventive');

    expect(fn () => $svc->decide($this->mod, $r, 'dismiss', 'ras'))->toThrow(DomainException::class);
    expect(fn () => $svc->decide($this->mod, $r, 'warning', 'ras'))->toThrow(DomainException::class);
    expect(fn () => $svc->decide($this->mod, $other, 'lift_preventive', 'ras'))->toThrow(DomainException::class);
});

it('mineur suspecté : confirmer par un bannissement remplace la suspension préventive', function () {
    $u = Seed::user('Teen3');
    $r = Seed::minorReport($u->id);

    app(\App\Services\Admin\ReportModeration::class)->decide($this->mod, $r, 'ban', 'Mineur confirmé.');

    expect(DB::table('users')->find($u->id)->status)->toBe('banned');
    expect(DB::table('sanctions')->where('user_id', $u->id)->where('kind', 'suspension')->value('ends_at'))->not->toBeNull();
    expect(DB::table('sanctions')->where('user_id', $u->id)->where('kind', 'ban')->count())->toBe(1);
});

it('refuse de traiter deux fois un signalement', function () {
    $u = Seed::user();
    $r = Seed::report($u->id);
    $svc = app(\App\Services\Admin\ReportModeration::class);
    $svc->decide($this->mod, $r, 'warning', 'Premier avertissement');

    expect(fn () => $svc->decide($this->mod, $r, 'ban', 'Bannissement'))->toThrow(DomainException::class);
    expect(DB::table('users')->find($u->id)->status)->toBe('active');
});

// ---------- Contestations ----------

it('accepte une contestation : sanction levée, compte réactivé, audit', function () {
    $u = Seed::user(status: 'suspended');
    $sanction = Seed::sanction($u->id, 'suspension', now()->addDays(10));
    $a = Seed::appeal($sanction, $u->id);

    Livewire::test(ListAppeals::class)->callTableAction('accept', \App\Filament\Models\Appeal::find($a), data: ['note' => 'Erreur de notre part.']);

    expect(DB::table('users')->find($u->id)->status)->toBe('active');
    expect(\Illuminate\Support\Carbon::parse(DB::table('sanctions')->find($sanction)->ends_at)->lessThanOrEqualTo(now()))->toBeTrue();
    expect(DB::table('appeals')->find($a))->toMatchArray(['status' => 'accepted', 'reviewed_by' => $this->mod->id, 'decision_note' => 'Erreur de notre part.']);
    expect(Seed::audit('appeal.accepted')->subject_id)->toBe($a);
});

it('accepter ne réactive pas le compte s’il reste une autre restriction', function () {
    $u = Seed::user(status: 'suspended');
    $s1 = Seed::sanction($u->id, 'suspension', now()->addDays(10));
    Seed::sanction($u->id, 'suspension', now()->addDays(20), 'autre');
    $a = Seed::appeal($s1, $u->id);

    app(\App\Services\Admin\AppealReview::class)->accept($this->mod, $a);

    expect(DB::table('users')->find($u->id)->status)->toBe('suspended');
    expect(DB::table('appeals')->find($a)->status)->toBe('accepted');
});

it('rejette une contestation avec une note obligatoire', function () {
    $u = Seed::user(status: 'banned');
    $sanction = Seed::sanction($u->id, 'ban');
    $a = Seed::appeal($sanction, $u->id);

    Livewire::test(ListAppeals::class)->callTableAction('reject', \App\Filament\Models\Appeal::find($a), data: ['note' => '']);
    expect(DB::table('appeals')->find($a)->status)->toBe('open');

    Livewire::test(ListAppeals::class)->callTableAction('reject', \App\Filament\Models\Appeal::find($a), data: ['note' => 'Les faits sont établis.']);

    expect(DB::table('appeals')->find($a))->toMatchArray(['status' => 'rejected', 'decision_note' => 'Les faits sont établis.', 'reviewed_by' => $this->mod->id]);
    expect(DB::table('users')->find($u->id)->status)->toBe('banned');
    expect(DB::table('sanctions')->find($sanction)->ends_at)->toBeNull();
    expect(Seed::audit('appeal.rejected')->subject_id)->toBe($a);
    expect(fn () => app(\App\Services\Admin\AppealReview::class)->reject($this->mod, $a, 'encore'))->toThrow(DomainException::class);
});

// ---------- Vérifications de profil ----------

it('consulter le selfie donne une URL signée courte et écrit une ligne d’audit sans l’URL', function () {
    $u = Seed::user();
    [$req] = Seed::verification($u->id);

    $component = Livewire::test(\App\Filament\Resources\VerificationRequestResource\Pages\ViewVerificationRequest::class, ['record' => $req])
        ->callAction('show_selfie');

    expect($component->get('selfieUrl'))->toBe("https://storage.test/get/u/{$u->id}/selfie.jpg?ttl=2");
    $audit = Seed::audit('verification.selfie_viewed');
    expect($audit->actor_staff_id)->toBe($this->mod->id)->and($audit->subject_id)->toBe($req)
        ->and(json_encode($audit))->not->toContain('storage.test')->and(json_encode($audit))->not->toContain('selfie.jpg');

    $component->callAction('show_selfie');
    expect(Seed::auditCount('verification.selfie_viewed'))->toBe(2);
});

it('ne montre jamais le selfie ni son URL dans la liste', function () {
    $u = Seed::user();
    Seed::verification($u->id);

    Livewire::test(\App\Filament\Resources\VerificationRequestResource\Pages\ListVerificationRequests::class)
        ->assertSuccessful()->assertDontSee('selfie.jpg')->assertDontSee('storage.test');
    expect(Seed::auditCount('verification.selfie_viewed'))->toBe(0);
});

it('approuve une vérification : badge vérifié, selfie supprimé, audit', function () {
    $u = Seed::user();
    [$req, $media] = Seed::verification($u->id);
    $this->storage->simulateUpload("u/{$u->id}/selfie.jpg", 10, 'image/jpeg');

    Livewire::test(\App\Filament\Resources\VerificationRequestResource\Pages\ViewVerificationRequest::class, ['record' => $req])->callAction('approve');

    expect(DB::table('verification_requests')->find($req))->toMatchArray(['status' => 'approved', 'reviewed_by' => $this->mod->id]);
    expect(DB::table('profiles')->where('user_id', $u->id)->value('verification_status'))->toBe('verified');
    expect(DB::table('media')->find($media)->status)->toBe('purged')->and($this->storage->deleted)->toBe(["u/{$u->id}/selfie.jpg"]);
    expect(Seed::audit('verification.approved')->subject_id)->toBe($req);
});

it('rejette une vérification avec un motif : statut rejected, selfie supprimé, audit', function () {
    $u = Seed::user();
    [$req, $media] = Seed::verification($u->id);

    Livewire::test(\App\Filament\Resources\VerificationRequestResource\Pages\ViewVerificationRequest::class, ['record' => $req])
        ->callAction('reject', data: ['reason' => 'Pose non conforme']);

    expect(DB::table('verification_requests')->find($req))->toMatchArray(['status' => 'rejected', 'reject_reason' => 'Pose non conforme', 'reviewed_by' => $this->mod->id]);
    expect(DB::table('profiles')->where('user_id', $u->id)->value('verification_status'))->toBe('rejected');
    expect(DB::table('media')->find($media)->status)->toBe('purged')->and($this->storage->deleted)->toHaveCount(1);
    expect(json_decode(Seed::audit('verification.rejected')->after, true)['reason'])->toBe('Pose non conforme');
});

it('ne traite pas deux fois une vérification et exige un motif de rejet', function () {
    $u = Seed::user();
    [$req] = Seed::verification($u->id);
    $svc = app(\App\Services\Admin\VerificationReview::class);

    expect(fn () => $svc->reject($this->mod, $req, ''))->toThrow(DomainException::class);
    $svc->approve($this->mod, $req);
    expect(fn () => $svc->approve($this->mod, $req))->toThrow(DomainException::class);
    expect(fn () => $svc->viewSelfie($this->mod, $req))->toThrow(DomainException::class);
    expect(Seed::auditCount('verification.approved'))->toBe(1);
});
