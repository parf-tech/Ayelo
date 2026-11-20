<?php

use App\Filament\Pages\LegalContentPage;
use App\Services\Admin\LegalContent;
use App\Services\Site\LegalPublished;
use Filament\Facades\Filament;
use Illuminate\Support\Facades\DB;
use Livewire\Features\SupportTesting\Testable;
use Livewire\Livewire;
use Tests\Feature\Admin\Support\Seed;
use Tests\Support\LegalFixture;

beforeEach(function () {
    Filament::setCurrentPanel('admin');
    LegalFixture::make();
});

/** Ouvre la page comme administrateur. */
function legalPage(): Testable
{
    test()->actingAs(Seed::staff('admin'), 'staff');

    return Livewire::test(LegalContentPage::class);
}

it('est réservée à l’administrateur', function () {
    $this->get('/admin/legal')->assertRedirect('/admin/login');

    foreach (['moderator' => 403, 'support' => 403, 'admin' => 200] as $role => $status) {
        $this->flushSession(); // AuthenticateSession compare le hash de mot de passe mémorisé : une session par membre du personnel.
        $this->actingAs(Seed::staff($role), 'staff')->get('/admin/legal')->assertStatus($status);
    }
});

it('affiche un champ par langue pour chaque emplacement du catalogue, avec le compteur de textes manquants', function () {
    legalPage()
        ->assertFormFieldExists('contact_privacy_email.fr')
        ->assertFormFieldExists('contact_privacy_email.en')
        ->assertFormFieldExists('terms_pricing.fr')
        ->assertFormFieldExists('terms_pricing.en')
        ->assertSee('4 champs sans texte publié');
});

it('pré-remplit le formulaire avec le brouillon, sinon le texte publié', function () {
    $admin = Seed::staff('admin');
    app(LegalContent::class)->saveDraft($admin, ['contact_privacy_email' => ['fr' => 'publié', 'en' => 'published']]);
    app(LegalContent::class)->publish($admin);
    app(LegalContent::class)->saveDraft($admin, ['contact_privacy_email' => ['fr' => 'brouillon']]);

    $this->actingAs($admin, 'staff');
    Livewire::test(LegalContentPage::class)
        ->assertFormSet(['contact_privacy_email.fr' => 'brouillon', 'contact_privacy_email.en' => 'published']);
});

it('enregistre un brouillon sans rien publier, et le journalise', function () {
    legalPage()
        ->fillForm(['contact_privacy_email' => ['fr' => 'privacy@ayelo.fr']])
        ->callAction('saveDraft')
        ->assertNotified();

    expect(DB::table('site_legal_fields')->where('key', 'contact_privacy_email')->where('lang', 'fr')->value('draft'))->toBe('privacy@ayelo.fr')
        ->and(legalPublishedValues())->toBe([])
        ->and(DB::table('audit_logs')->where('action', 'legal.draft_saved')->count())->toBe(1);
});

it('publie les modifications saisies, brouillons compris, après confirmation', function () {
    legalPage()
        ->fillForm(['contact_privacy_email' => ['fr' => 'privacy@ayelo.fr'], 'terms_pricing' => ['fr' => "Premier\n\nSecond"]])
        ->mountAction('publish')
        ->assertMountedActionModalSee(['E-mail pour les données personnelles', 'Prix et rétractation'])
        ->callMountedAction()
        ->assertNotified();

    expect(legalPublishedValues())->toBe(['contact_privacy_email' => ['fr' => 'privacy@ayelo.fr'], 'terms_pricing' => ['fr' => "Premier\n\nSecond"]])
        ->and(DB::table('audit_logs')->where('action', 'legal.published')->count())->toBe(1);
});

it('désactive la publication tant que rien n’a changé', function () {
    legalPage()->assertActionDisabled('publish');
});

it('abandonne les brouillons sans toucher au texte publié', function () {
    $admin = Seed::staff('admin');
    app(LegalContent::class)->saveDraft($admin, ['contact_privacy_email' => ['fr' => 'a']]);
    app(LegalContent::class)->publish($admin);
    app(LegalContent::class)->saveDraft($admin, ['contact_privacy_email' => ['fr' => 'b']]);

    $this->actingAs($admin, 'staff');
    Livewire::test(LegalContentPage::class)->callAction('discard')->assertNotified()->assertFormSet(['contact_privacy_email.fr' => 'a']);

    expect(app(LegalContent::class)->pending())->toBe([])
        ->and(legalPublishedValues())->toBe(['contact_privacy_email' => ['fr' => 'a']]);
});

it('retire puis réaffiche la bannière provisoire', function () {
    $page = legalPage();

    $page->callAction('banner')->assertNotified();
    expect(app(LegalPublished::class)->bannerVisible())->toBeFalse();

    $page->callAction('banner');
    expect(app(LegalPublished::class)->bannerVisible())->toBeTrue();
});

it('refuse un texte trop long sans rien écrire', function () {
    legalPage()
        ->fillForm(['contact_privacy_email' => ['fr' => str_repeat('x', 301)]])
        ->callAction('saveDraft')
        ->assertHasFormErrors(['contact_privacy_email.fr']);

    expect(DB::table('site_legal_fields')->count())->toBe(0);
});

/** @return array<string, array<string, string>> */
function legalPublishedValues(): array
{
    return app(LegalPublished::class)->values();
}
