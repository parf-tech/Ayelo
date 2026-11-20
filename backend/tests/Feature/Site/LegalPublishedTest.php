<?php

use App\Services\Site\LegalPublished;
use Illuminate\Support\Facades\DB;

it('relit la base au bout de dix minutes même si une publication n’a pas pu invalider le cache', function () {
    $published = app(LegalPublished::class);
    expect($published->values())->toBe([]); // instantané en cache

    // Écriture sans passer par LegalContent : simule une lecture à froid qui a réécrit un ancien instantané après la publication.
    DB::table('site_legal_fields')->insert(['key' => 'contact_privacy_email', 'lang' => 'fr', 'published' => 'privacy@ayelo.fr']);
    expect($published->values())->toBe([]); // encore l'ancien instantané : le cache fait son travail

    $this->travel(11)->minutes();

    expect($published->values())->toBe(['contact_privacy_email' => ['fr' => 'privacy@ayelo.fr']]);
});
