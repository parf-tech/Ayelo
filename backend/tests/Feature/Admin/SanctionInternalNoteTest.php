<?php

// Note interne d'une sanction (revue pentest P-09) : séparée du motif communiqué à la personne. Saisie au back-office, visible du
// personnel seulement : jamais dans GET /me/sanctions ni dans l'export des données, effacée avec le motif à la fin de la conservation.

use App\Filament\Models\Member;
use App\Filament\Models\Report;
use App\Filament\Resources\MemberResource\Pages\ViewMember;
use App\Filament\Resources\MemberResource\RelationManagers\SanctionsRelationManager;
use App\Filament\Resources\ReportResource\Pages\ListReports;
use App\Services\AccountDeletion;
use App\Services\DataExport;
use App\Services\Storage\MediaStorage;
use Filament\Facades\Filament;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Livewire\Livewire;
use Tests\Feature\Admin\Support\Seed;
use Tests\Support\FakeMediaStorage;

const NOTE_INTERNE = 'Contexte interne : récidive signalée par deux personnes.';

beforeEach(function () {
    Filament::setCurrentPanel('admin');
    $this->admin = Seed::staff('admin');
    $this->actingAs($this->admin, 'staff');
});

function sn_sanction(string $userId): object
{
    return DB::table('sanctions')->where('user_id', $userId)->first();
}

it('décision sur un signalement : le motif et la note interne sont rangés séparément', function (string $action, array $data) {
    $user = Seed::user();
    $report = Seed::report($user->id);

    Livewire::test(ListReports::class)->callTableAction($action, Report::find($report), data: $data + ['note' => 'Motif communiqué.', 'internal_note' => NOTE_INTERNE]);

    expect(sn_sanction($user->id)->reason)->toBe('Motif communiqué.')->and(sn_sanction($user->id)->internal_note)->toBe(NOTE_INTERNE);
})->with([
    'avertissement' => ['warn', []],
    'suspension' => ['suspend', ['days' => 7]],
    'bannissement' => ['ban', []],
]);

it('la note interne est facultative : vide, rien n’est enregistré', function () {
    $user = Seed::user();
    $report = Seed::report($user->id);

    Livewire::test(ListReports::class)->callTableAction('warn', Report::find($report), data: ['note' => 'Motif communiqué.', 'internal_note' => '   ']);

    expect(sn_sanction($user->id)->internal_note)->toBeNull();
});

it('fiche d’un membre : suspension et bannissement acceptent une note interne', function (string $action, array $data) {
    $user = Seed::user();

    Livewire::test(ViewMember::class, ['record' => $user->id])
        ->callAction($action, data: $data + ['reason' => 'Motif communiqué.', 'internal_note' => NOTE_INTERNE])
        ->assertHasNoActionErrors();

    expect(sn_sanction($user->id)->reason)->toBe('Motif communiqué.')->and(sn_sanction($user->id)->internal_note)->toBe(NOTE_INTERNE);
})->with([
    'suspension' => ['suspend', ['days' => 3]],
    'bannissement' => ['ban', []],
]);

it('le personnel voit la note interne dans les sanctions du membre', function () {
    $user = Seed::user();
    $sanction = Seed::sanction($user->id, 'warning', null, 'Motif communiqué.');
    DB::table('sanctions')->where('id', $sanction)->update(['internal_note' => NOTE_INTERNE]);

    Livewire::test(SanctionsRelationManager::class, ['ownerRecord' => Member::find($user->id), 'pageClass' => ViewMember::class])
        ->assertSee(NOTE_INTERNE);
});

it('ni la personne sanctionnée ni son export de données ne reçoivent la note interne', function () {
    $storage = new FakeMediaStorage;
    app()->instance(MediaStorage::class, $storage);
    $user = Seed::user();
    $sanction = Seed::sanction($user->id, 'warning', null, 'Motif communiqué.');
    DB::table('sanctions')->where('id', $sanction)->update(['internal_note' => NOTE_INTERNE]);

    $body = $this->withHeader('Authorization', 'Bearer '.$user->createToken('t')->plainTextToken)
        ->getJson('/api/v1/me/sanctions')->assertOk()->assertJsonPath('data.0.reason', 'Motif communiqué.')->getContent();
    expect($body)->not->toContain('internal_note')->not->toContain('Contexte interne');

    $export = (string) Str::uuid();
    DB::table('data_exports')->insert(['id' => $export, 'user_id' => $user->id, 'status' => 'pending', 'created_at' => now(), 'updated_at' => now()]);
    app(DataExport::class)->build($export);
    $file = $storage->contents['exports/'.$user->id.'/'.$export.'.json'];
    expect($file)->toContain('Motif communiqué.')->not->toContain('internal_note')->not->toContain('Contexte interne');
});

it('la fin de conservation efface la note interne avec le motif, même déjà remplacé', function () {
    $gone = Seed::user('Parti', 'deleted');
    $old = now()->subDays((int) config('retention.sanction_reason_days', 365) + 1);
    $withNote = Seed::sanction($gone->id, 'ban', null, 'motif libre ancien');
    $alreadyPurged = Seed::sanction($gone->id, 'warning', null, AccountDeletion::PURGED_REASON);
    DB::table('sanctions')->whereIn('id', [$withNote, $alreadyPurged])->update(['internal_note' => NOTE_INTERNE, 'created_at' => $old]);

    expect(app(AccountDeletion::class)->purgeRetainedText()['sanctions'])->toBe(2);

    foreach ([$withNote, $alreadyPurged] as $id) {
        expect(DB::table('sanctions')->find($id)->internal_note)->toBeNull()
            ->and(DB::table('sanctions')->find($id)->reason)->toBe(AccountDeletion::PURGED_REASON);
    }
    expect(app(AccountDeletion::class)->purgeRetainedText()['sanctions'])->toBe(0);
});
