<?php

// Langue du back-office : préférence enregistrée par membre du personnel (colonne `staff_users.locale`), sinon ADMIN_LOCALE.
// Jamais déduite de l'en-tête Accept-Language : un navigateur en anglais ne doit pas faire basculer, sans le vouloir, un
// back-office dont la formation et la documentation sont en français (décision déjà prise, StaffLocale).
// Bandeau d'environnement : hors production seulement.

use App\Filament\Pages\Auth\EditStaffProfile;
use App\Filament\Support\Staff;
use App\Filament\Support\StaffLocale;
use Filament\Facades\Filament;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Livewire\Livewire;
use Tests\Feature\Admin\Support\Seed;

beforeEach(function () {
    Filament::setCurrentPanel('admin');
    config(['app.admin_locale' => 'fr']);
});

function sl_locale(string $id, ?string $locale): void
{
    DB::table('staff_users')->where('id', $id)->update(['locale' => $locale]);
}

it('sans préférence, la langue est celle d’ADMIN_LOCALE', function () {
    $staff = Seed::staff('moderator');
    $this->actingAs($staff, 'staff');

    expect(StaffLocale::resolve())->toBe('fr');
    config(['app.admin_locale' => 'en']);
    expect(StaffLocale::resolve())->toBe('en');
});

it('la préférence enregistrée l’emporte sur ADMIN_LOCALE, dans les deux sens', function () {
    $staff = Seed::staff('moderator');
    $this->actingAs($staff, 'staff');

    sl_locale($staff->id, 'en');
    app('auth')->guard('staff')->setUser($staff->fresh());
    expect(StaffLocale::resolve())->toBe('en')->and(Staff::t('admin.action.warn'))->toBe('Warn');

    config(['app.admin_locale' => 'en']);
    sl_locale($staff->id, 'fr');
    app('auth')->guard('staff')->setUser($staff->fresh());
    expect(StaffLocale::resolve())->toBe('fr')->and(Staff::t('admin.action.warn'))->toBe('Avertir');
});

it('une préférence inconnue est ignorée, et la base la refuse', function () {
    $staff = Seed::staff('moderator');
    $staff->locale = 'de'; // en mémoire seulement : jamais enregistrée
    $this->actingAs($staff, 'staff');

    expect(StaffLocale::resolve())->toBe('fr');
    expect(fn () => sl_locale($staff->id, 'de'))->toThrow(QueryException::class);
});

it('l’en-tête Accept-Language n’est jamais utilisé', function () {
    $staff = Seed::staff('moderator');
    $this->actingAs($staff, 'staff');
    app()->setLocale('en');

    $request = Request::create('/admin', 'GET', server: ['HTTP_ACCEPT_LANGUAGE' => 'en-US,en;q=0.9']);
    (new StaffLocale)->handle($request, fn () => response('ok'));

    expect(app()->getLocale())->toBe('fr');
});

it('le profil enregistre la langue choisie et la trace, sans simuler un changement de mot de passe', function () {
    $staff = Seed::staff('moderator');
    $this->actingAs($staff, 'staff');

    Livewire::test(EditStaffProfile::class)->fillForm(['locale' => 'en'])->call('save')->assertHasNoFormErrors();

    expect(DB::table('staff_users')->where('id', $staff->id)->value('locale'))->toBe('en');
    $audit = Seed::audit('staff.locale_changed');
    expect($audit->actor_staff_id)->toBe($staff->id)->and(json_decode($audit->after, true)['locale'])->toBe('en');
    expect(Seed::audit('staff.password_changed'))->toBeNull();
});

it('« Par défaut » efface la préférence ; une langue inconnue est refusée', function () {
    $staff = Seed::staff('moderator');
    sl_locale($staff->id, 'en');
    $this->actingAs($staff->fresh(), 'staff');

    Livewire::test(EditStaffProfile::class)->fillForm(['locale' => 'de'])->call('save')->assertHasFormErrors(['locale']);
    expect(DB::table('staff_users')->where('id', $staff->id)->value('locale'))->toBe('en');

    Livewire::test(EditStaffProfile::class)->fillForm(['locale' => null])->call('save')->assertHasNoFormErrors();
    expect(DB::table('staff_users')->where('id', $staff->id)->value('locale'))->toBeNull();
});

it('changer le mot de passe reste tracé comme avant', function () {
    $staff = Seed::staff('moderator');
    $this->actingAs($staff, 'staff');

    Livewire::test(EditStaffProfile::class)
        ->fillForm(['password' => 'un-mot-de-passe-tres-long-1', 'passwordConfirmation' => 'un-mot-de-passe-tres-long-1', 'currentPassword' => Seed::PASSWORD])
        ->call('save')->assertHasNoFormErrors();

    expect(Seed::audit('staff.password_changed')->actor_staff_id)->toBe($staff->id);
});

// ---------- bandeau d'environnement ----------

it('affiche un bandeau d’environnement hors production, avec le libellé configuré', function () {
    $this->get('/admin/login')->assertOk()->assertSee('Environnement : testing');

    config(['admin.environment_label' => 'Préproduction']);
    $this->get('/admin/login')->assertOk()->assertSee('Préproduction')->assertDontSee('Environnement : testing');
});

it('n’affiche aucun bandeau en production, même avec un libellé', function () {
    app()->detectEnvironment(fn () => 'production');
    config(['admin.environment_label' => 'Préproduction']);

    $this->get('/admin/login')->assertOk()->assertDontSee('Préproduction')->assertDontSee('Environnement :');
});

it('le bandeau suit la langue du back-office', function () {
    config(['app.admin_locale' => 'en']);

    $this->get('/admin/login')->assertOk()->assertSee('Environment: testing');
});
