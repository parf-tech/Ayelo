<?php

use App\Services\Admin\LegalContent;
use Tests\Feature\Admin\Support\Seed;
use Tests\Support\LegalFixture;

beforeEach(function () {
    LegalFixture::make();
});

it('sert une page remplie, publique et cachable, sans cookie', function () {
    $response = $this->get('/_site/legal/terms');

    $response->assertOk()
        ->assertHeader('X-Site-Source', 'app')
        ->assertHeader('Content-Type', 'text/html; charset=utf-8')
        ->assertHeaderMissing('Set-Cookie')
        ->assertSee('<html lang="fr">', false);
    expect($response->headers->get('Cache-Control'))->toContain('public')->toContain('max-age=300')
        ->and($response->headers->get('ETag'))->not->toBeEmpty()
        ->and($response->headers->getCookies())->toBe([]);
});

it('sert l’accueil et la version anglaise', function () {
    $this->get('/_site/')->assertOk()->assertSee('<html lang="fr">', false);
    $this->get('/_site')->assertOk();
    $this->get('/_site/en/')->assertOk()->assertSee('<html lang="en">', false);
});

it('répond 304 quand l’ETag n’a pas changé', function () {
    $etag = $this->get('/_site/legal/terms')->headers->get('ETag');

    $this->withHeader('If-None-Match', $etag)->get('/_site/legal/terms')->assertStatus(304);
});

it('change le contenu et l’ETag après une publication', function () {
    $before = $this->get('/_site/legal/terms');
    $admin = Seed::staff('admin');
    app(LegalContent::class)->saveDraft($admin, ['contact_privacy_email' => ['fr' => 'privacy@ayelo.fr']]);
    $this->get('/_site/legal/terms')->assertDontSee('privacy@ayelo.fr'); // brouillon : toujours invisible
    app(LegalContent::class)->publish($admin);

    $after = $this->get('/_site/legal/terms');

    $after->assertOk()->assertSee('Contact : privacy@ayelo.fr', false);
    expect($after->headers->get('ETag'))->not->toBe($before->headers->get('ETag'));
});

it('ne met jamais en cache la page de confirmation de suppression (adresse à jeton)', function () {
    $response = $this->get('/_site/confirm-deletion');

    $response->assertOk();
    expect($response->headers->get('Cache-Control'))->toContain('no-store');
});

it('répond 404 pour une page inconnue, une remontée de dossier ou une ressource', function (string $path) {
    $this->get('/_site/'.$path)->assertNotFound();
})->with(['inconnue', 'tools/legal-slots.json', '404.html', 'assets/site.css', '..%2F..%2F.env', '%2e%2e/%2e%2e/.env']);

it('n’accepte que la lecture', function () {
    $this->post('/_site/legal/terms')->assertStatus(405);
});

it('ne démarre pas de session : aucune ligne de session ni en-tête Set-Cookie même avec un cookie envoyé', function () {
    $response = $this->withCookie('laravel_session', 'x')->get('/_site/legal/terms');

    $response->assertOk()->assertHeaderMissing('Set-Cookie');
});
