<?php

use App\Services\Site\LegalCatalog;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Tests\Support\LegalFixture;

it('lit les champs, groupes et pages du catalogue', function () {
    LegalFixture::make();
    $catalog = new LegalCatalog;

    expect($catalog->has('contact_privacy_email'))->toBeTrue()
        ->and($catalog->has('absent'))->toBeFalse()
        ->and($catalog->kind('terms_pricing'))->toBe('block')
        ->and($catalog->kind('contact_privacy_email'))->toBe('line')
        ->and($catalog->max('contact_privacy_email'))->toBe(300)
        ->and($catalog->max('terms_pricing'))->toBe(5000)
        ->and($catalog->pages())->toContain('legal/terms.html', 'en/legal/terms.html')
        ->and($catalog->groups())->toBe(['contacts' => ['contact_privacy_email'], 'terms' => ['terms_pricing']])
        ->and($catalog->slots()['contact_privacy_email']['label']['en'])->toBe('Personal data e-mail');
});

it('refuse un catalogue absent en nommant le fichier attendu', function () {
    config(['site.web_root' => sys_get_temp_dir().'/ayelo-inexistant-'.bin2hex(random_bytes(4))]);

    expect(fn () => (new LegalCatalog)->slots())->toThrow(RuntimeException::class, 'legal-slots.json');
});

it('refuse un catalogue qui n’est pas du JSON valide', function () {
    $root = LegalFixture::make();
    file_put_contents($root.'/tools/legal-slots.json', '{pas du json');

    expect(fn () => (new LegalCatalog)->slots())->toThrow(RuntimeException::class, 'legal-slots.json');
});

it('refuse un catalogue sans la version attendue', function () {
    $root = LegalFixture::make();
    file_put_contents($root.'/tools/legal-slots.json', json_encode(['version' => 99, 'pages' => [], 'groups' => [], 'slots' => []]));

    expect(fn () => (new LegalCatalog)->slots())->toThrow(RuntimeException::class, 'version');
});

it('configure le dossier du site et la durée de cache par défaut', function () {
    expect(config('site.cache_seconds'))->toBe(300)
        ->and(is_dir((string) config('site.web_root')))->toBeTrue();
});

it('le catalogue du dépôt correspond exactement aux pages générées (aucune dérive entre le site et le formulaire)', function () {
    $catalog = new LegalCatalog; // config par défaut : le dossier web/ du dépôt
    $found = [];

    expect($catalog->pages())->not->toContain('404.html')->and($catalog->pages())->not->toBeEmpty();
    foreach ($catalog->pages() as $page) {
        $file = config('site.web_root').'/'.$page;
        expect(is_file($file))->toBeTrue("page absente : {$page}");
        preg_match_all('/data-legal(?:-block)?="([a-z0-9_]+)"/', (string) file_get_contents($file), $m);
        array_push($found, ...$m[1]);
    }
    $found = array_values(array_unique($found));

    expect(array_diff($found, array_keys($catalog->slots())))->toBe([], 'clés de page absentes du catalogue')
        ->and(array_diff(array_keys($catalog->slots()), $found))->toBe([], 'clés du catalogue absentes des pages');
    foreach ($catalog->slots() as $key => $slot) {
        expect($catalog->max($key))->toBe($slot['kind'] === 'block' ? 5000 : 300)
            ->and(trim($slot['hint']['fr']))->not->toBe('')
            ->and(trim($slot['hint']['en']))->not->toBe('');
    }
    $grouped = array_merge(...array_values($catalog->groups()));
    sort($grouped);
    $all = array_keys($catalog->slots());
    sort($all);
    expect($grouped)->toBe($all);
});

it('crée les tables des mentions légales avec leurs contraintes', function () {
    $tables = collect(DB::select("select table_name from information_schema.tables where table_schema = 'public'"))->pluck('table_name');
    expect($tables)->toContain('site_legal_fields', 'site_legal_settings');

    DB::table('site_legal_fields')->insert(['key' => 'k', 'lang' => 'fr']);
    expect(fn () => DB::table('site_legal_fields')->insert(['key' => 'k', 'lang' => 'fr']))->toThrow(QueryException::class);
    expect(fn () => DB::table('site_legal_fields')->insert(['key' => 'k', 'lang' => 'de']))->toThrow(QueryException::class);
});
