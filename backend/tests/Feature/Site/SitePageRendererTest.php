<?php

use App\Services\Admin\LegalContent;
use App\Services\Site\SitePageRenderer;
use Tests\Feature\Admin\Support\Seed;
use Tests\Support\LegalFixture;

beforeEach(function () {
    LegalFixture::make();
});

/** Enregistre puis publie des textes, comme le ferait l'administrateur. */
function sitePublish(array $values): void
{
    $admin = Seed::staff('admin');
    app(LegalContent::class)->saveDraft($admin, $values);
    app(LegalContent::class)->publish($admin);
}

function renderer(): SitePageRenderer
{
    return app(SitePageRenderer::class);
}

it('remplace un champ ligne dans la langue de la page et conserve le marqueur de l’autre langue', function () {
    sitePublish(['contact_privacy_email' => ['fr' => 'privacy@ayelo.fr']]);

    $fr = renderer()->render('legal/terms.html');
    $en = renderer()->render('en/legal/terms.html');

    expect($fr)->toContain('<p>Contact : privacy@ayelo.fr</p>')
        ->and($fr)->not->toContain('privacy@example.invalid')
        ->and($en)->toContain('[TO BE COMPLETED: privacy@example.invalid]')
        ->and($en)->toContain('data-legal="contact_privacy_email"');
});

it('remplace deux champs voisins sur une même ligne sans que l’un avale l’autre', function () {
    LegalFixture::make(null, ['index.html' => '<p><mark class="todo" data-legal="contact_privacy_email">[À COMPLÉTER : a]</mark> et <mark class="todo" data-legal="contact_privacy_email">[À COMPLÉTER : b]</mark></p>']);
    sitePublish(['contact_privacy_email' => ['fr' => 'X']]);

    expect(renderer()->render('index.html'))->toBe('<p>X et X</p>');
});

it('remplace un bloc par un paragraphe par texte, avec un retour à la ligne pour un saut simple', function () {
    sitePublish(['terms_pricing' => ['fr' => "Premier\nsuite\n\nSecond"]]);

    $html = renderer()->render('legal/terms.html');

    expect($html)->toContain('<p>Premier<br />', '</p>')
        ->and($html)->toContain('suite</p>')
        ->and($html)->toContain('<p>Second</p>')
        ->and($html)->not->toContain('data-legal-block')
        ->and($html)->not->toContain('[À COMPLÉTER : prix]');
});

it('échappe tout le HTML et n’interprète jamais le texte comme une référence de remplacement', function () {
    $hostile = '<script>alert(1)</script> & "x" \'y\' $1 \1 ${0} {{k|a}}';
    sitePublish(['contact_privacy_email' => ['fr' => $hostile], 'terms_pricing' => ['fr' => $hostile]]);

    $html = renderer()->render('legal/terms.html');

    expect($html)->not->toContain('<script>')
        ->and(substr_count($html, '&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot; &#039;y&#039; $1 \1 ${0} {{k|a}}'))->toBe(2);
});

it('garde le marqueur quand le texte est absent, vide, ou seulement en brouillon', function () {
    $admin = Seed::staff('admin');
    app(LegalContent::class)->saveDraft($admin, ['contact_privacy_email' => ['fr' => 'brouillon seulement']]);

    expect(renderer()->render('legal/terms.html'))->toContain('[À COMPLÉTER : privacy@example.invalid]')
        ->and(renderer()->render('legal/terms.html'))->not->toContain('brouillon seulement');

    app(LegalContent::class)->publish($admin);
    app(LegalContent::class)->saveDraft($admin, ['contact_privacy_email' => ['fr' => '']]);
    app(LegalContent::class)->publish($admin);

    expect(renderer()->render('legal/terms.html'))->toContain('[À COMPLÉTER : privacy@example.invalid]');
});

it('laisse intact un emplacement que le catalogue ne connaît pas, sans exception', function () {
    $page = '<p><mark class="todo" data-legal="nouvelle_cle">[À COMPLÉTER : x]</mark></p>';
    LegalFixture::make(null, ['index.html' => $page]);
    sitePublish(['contact_privacy_email' => ['fr' => 'a']]);

    expect(renderer()->render('index.html'))->toBe($page);
});

it('retire la bannière provisoire seulement quand elle est masquée', function () {
    expect(renderer()->render('index.html'))->toContain('data-legal-banner')->toContain('Version provisoire');

    app(LegalContent::class)->setBannerVisible(Seed::staff('admin'), false);
    $html = renderer()->render('index.html');

    expect($html)->not->toContain('data-legal-banner')->not->toContain('Version provisoire')->toContain('<main>');
});

it('résout les adresses comme Caddy et seulement vers les pages du catalogue', function (string $url, ?string $page) {
    expect(renderer()->pageFor($url))->toBe($page);
})->with([
    'racine vide' => ['', 'index.html'],
    'racine' => ['/', 'index.html'],
    'accueil anglais avec barre' => ['en/', 'en/index.html'],
    'accueil anglais sans barre' => ['en', 'en/index.html'],
    'adresse propre' => ['legal/terms', 'legal/terms.html'],
    'adresse avec extension' => ['legal/terms.html', 'legal/terms.html'],
    'page à la racine' => ['support', 'support.html'],
    'page anglaise' => ['en/legal/terms', 'en/legal/terms.html'],
    'page de confirmation' => ['confirm-deletion', 'confirm-deletion.html'],
    'barre finale sur une page' => ['legal/terms/', null],
    'remontée de dossier' => ['../.env', null],
    'remontée depuis la racine' => ['/../.env', null],
    'remontée encodée décodée' => ['%2e%2e/.env', null],
    'catalogue' => ['tools/legal-slots.json', null],
    'page 404' => ['404', null],
    'page 404 avec extension' => ['404.html', null],
    'ressource' => ['assets/site.css', null],
    'double barre' => ['//', null],
    'double barre au milieu' => ['legal//terms', null],
    'antislash' => ['legal\\terms', null],
    'octet nul' => ["legal/terms\0", null],
    'page inconnue' => ['inconnue', null],
]);
