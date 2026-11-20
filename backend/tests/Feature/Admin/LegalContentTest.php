<?php

use App\Models\StaffUser;
use App\Services\Admin\Audit;
use App\Services\Admin\LegalContent;
use App\Services\Admin\Permissions;
use App\Services\Site\LegalPublished;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Admin\Support\Seed;
use Tests\Support\LegalFixture;

beforeEach(function () {
    LegalFixture::make();
});

function legalService(): LegalContent
{
    return app(LegalContent::class);
}

function legalPublished(): LegalPublished
{
    return app(LegalPublished::class);
}

/** @return array<string, mixed>|null */
function legalAudit(string $action, string $side = 'after'): ?array
{
    $row = DB::table('audit_logs')->where('action', $action)->orderByDesc('id')->first();

    return $row === null ? null : json_decode((string) $row->{$side}, true);
}

it('réserve le droit legal.manage à l’administrateur', function () {
    expect(Permissions::for(StaffUser::ROLE_ADMIN))->toContain(Permissions::LEGAL_MANAGE)
        ->and(Permissions::for(StaffUser::ROLE_MODERATOR))->not->toContain(Permissions::LEGAL_MANAGE)
        ->and(Permissions::for(StaffUser::ROLE_SUPPORT))->not->toContain(Permissions::LEGAL_MANAGE)
        ->and(Permissions::LEGAL_MANAGE)->toBe('legal.manage');
});

it('refuse toute écriture à un modérateur ou au support', function (string $role) {
    $staff = Seed::staff($role);
    $draft = ['contact_privacy_email' => ['fr' => 'privacy@ayelo.fr']];

    expect(fn () => legalService()->saveDraft($staff, $draft))->toThrow(AuthorizationException::class)
        ->and(fn () => legalService()->publish($staff))->toThrow(AuthorizationException::class)
        ->and(fn () => legalService()->discard($staff))->toThrow(AuthorizationException::class)
        ->and(fn () => legalService()->setBannerVisible($staff, false))->toThrow(AuthorizationException::class);
    expect(DB::table('site_legal_fields')->count())->toBe(0)->and(DB::table('audit_logs')->count())->toBe(0);
})->with(['moderator', 'support']);

it('n’affiche pas un brouillon et publie à la demande', function () {
    $admin = Seed::staff('admin');
    expect(legalPublished()->values())->toBe([]); // amorce le cache : la publication doit l'invalider

    expect(legalService()->saveDraft($admin, ['contact_privacy_email' => ['fr' => 'privacy@ayelo.fr']]))->toBe(1)
        ->and(legalPublished()->values())->toBe([]);

    expect(legalService()->publish($admin))->toBe(1)
        ->and(legalPublished()->values())->toBe(['contact_privacy_email' => ['fr' => 'privacy@ayelo.fr']])
        ->and(DB::table('site_legal_fields')->first()->draft)->toBeNull();
});

it('une valeur égale au texte publié ne laisse pas de brouillon', function () {
    $admin = Seed::staff('admin');
    legalService()->saveDraft($admin, ['contact_privacy_email' => ['fr' => 'a']]);
    legalService()->publish($admin);

    expect(legalService()->saveDraft($admin, ['contact_privacy_email' => ['fr' => 'a']]))->toBe(0)
        ->and(legalService()->pending())->toBe([]);

    legalService()->saveDraft($admin, ['contact_privacy_email' => ['fr' => 'b']]);
    expect(legalService()->pending())->toBe(['contact_privacy_email.fr']);
    expect(legalService()->saveDraft($admin, ['contact_privacy_email' => ['fr' => 'a']]))->toBe(1)
        ->and(legalService()->pending())->toBe([]);
});

it('une valeur vide efface le texte publié à la publication', function () {
    $admin = Seed::staff('admin');
    legalService()->saveDraft($admin, ['contact_privacy_email' => ['fr' => 'a', 'en' => 'b']]);
    legalService()->publish($admin);

    expect(legalService()->saveDraft($admin, ['contact_privacy_email' => ['fr' => '']]))->toBe(1)
        ->and(legalService()->state()['contact_privacy_email']['fr'])->toBe(['draft' => '', 'published' => 'a']);
    legalService()->publish($admin);

    expect(legalPublished()->values())->toBe(['contact_privacy_email' => ['en' => 'b']])
        ->and(legalService()->state()['contact_privacy_email']['fr'])->toBe(['draft' => null, 'published' => null]);
});

it('ne touche pas un champ dont la valeur est null', function () {
    $admin = Seed::staff('admin');
    legalService()->saveDraft($admin, ['contact_privacy_email' => ['fr' => 'a', 'en' => 'b']]);

    expect(legalService()->saveDraft($admin, ['contact_privacy_email' => ['fr' => 'a2', 'en' => null]]))->toBe(1)
        ->and(legalService()->state()['contact_privacy_email']['en']['draft'])->toBe('b');
});

it('normalise les fins de ligne et rogne les espaces', function () {
    legalService()->saveDraft(Seed::staff('admin'), ['contact_privacy_email' => ['fr' => "  Rue A\r\nParis \n"]]);

    expect(DB::table('site_legal_fields')->value('draft'))->toBe("Rue A\nParis");
});

it('refuse une clé inconnue, une langue inconnue, un texte trop long ou un caractère de contrôle, sans rien écrire', function (array $values) {
    $admin = Seed::staff('admin');
    $good = ['contact_privacy_email' => ['fr' => 'valide']];

    expect(fn () => legalService()->saveDraft($admin, $good + $values))->toThrow(DomainException::class);
    expect(DB::table('site_legal_fields')->count())->toBe(0)->and(DB::table('audit_logs')->count())->toBe(0);
})->with([
    'clé inconnue' => [['absente' => ['fr' => 'x']]],
    'langue inconnue' => [['terms_pricing' => ['de' => 'x']]],
    'caractère nul' => [['terms_pricing' => ['fr' => "a\x00b"]]],
    'UTF-8 invalide' => [['terms_pricing' => ['fr' => "a\xC3\x28b"]]],
]);

it('applique la longueur maximale du catalogue (300 pour une ligne, 5 000 pour des paragraphes)', function () {
    $admin = Seed::staff('admin');

    expect(fn () => legalService()->saveDraft($admin, ['contact_privacy_email' => ['fr' => str_repeat('é', 301)]]))->toThrow(DomainException::class)
        ->and(fn () => legalService()->saveDraft($admin, ['terms_pricing' => ['fr' => str_repeat('x', 5001)]]))->toThrow(DomainException::class);

    expect(legalService()->saveDraft($admin, ['contact_privacy_email' => ['fr' => str_repeat('é', 300)], 'terms_pricing' => ['fr' => str_repeat('x', 5000)]]))->toBe(2);
});

it('publier ou abandonner sans brouillon ne fait rien et n’écrit pas dans le journal', function () {
    $admin = Seed::staff('admin');
    legalService()->saveDraft($admin, ['contact_privacy_email' => ['fr' => 'a']]);

    expect(legalService()->publish($admin))->toBe(1)
        ->and(legalService()->publish($admin))->toBe(0)
        ->and(legalService()->discard($admin))->toBe(0)
        ->and(DB::table('audit_logs')->where('action', 'legal.published')->count())->toBe(1)
        ->and(DB::table('audit_logs')->where('action', 'legal.discarded')->count())->toBe(0);
});

it('abandonne les brouillons sans toucher au texte publié', function () {
    $admin = Seed::staff('admin');
    legalService()->saveDraft($admin, ['contact_privacy_email' => ['fr' => 'a']]);
    legalService()->publish($admin);
    legalService()->saveDraft($admin, ['contact_privacy_email' => ['fr' => 'b', 'en' => 'c']]);

    expect(legalService()->discard($admin))->toBe(2)
        ->and(legalService()->pending())->toBe([])
        ->and(legalPublished()->values())->toBe(['contact_privacy_email' => ['fr' => 'a']])
        ->and(legalAudit('legal.discarded', 'before'))->toEqual(['contact_privacy_email.fr' => 'b', 'contact_privacy_email.en' => 'c']);
});

it('journalise l’enregistrement d’un brouillon et chaque publication avec l’avant et l’après', function () {
    $admin = Seed::staff('admin');
    legalService()->saveDraft($admin, ['contact_privacy_email' => ['fr' => 'a']]);

    expect(legalAudit('legal.draft_saved'))->toBe(['contact_privacy_email.fr' => 'a'])
        ->and(DB::table('audit_logs')->where('action', 'legal.draft_saved')->value('actor_staff_id'))->toBe($admin->getKey());

    legalService()->publish($admin);
    legalService()->saveDraft($admin, ['contact_privacy_email' => ['fr' => 'b']]);
    legalService()->publish($admin);

    expect(legalAudit('legal.published', 'before'))->toBe(['contact_privacy_email.fr' => 'a'])
        ->and(legalAudit('legal.published'))->toBe(['contact_privacy_email.fr' => 'b']);
});

it('affiche la bannière provisoire par défaut et journalise son retrait', function () {
    $admin = Seed::staff('admin');
    expect(legalPublished()->bannerVisible())->toBeTrue();

    legalService()->setBannerVisible($admin, false);
    expect(legalPublished()->bannerVisible())->toBeFalse()
        ->and(legalAudit('legal.banner_changed', 'before'))->toBe(['banner_visible' => true])
        ->and(legalAudit('legal.banner_changed'))->toBe(['banner_visible' => false]);

    legalService()->setBannerVisible($admin, false); // déjà retirée : aucun bruit d'audit
    expect(DB::table('audit_logs')->where('action', 'legal.banner_changed')->count())->toBe(1);

    legalService()->setBannerVisible($admin, true);
    expect(legalPublished()->bannerVisible())->toBeTrue();
});

it('n’écrit pas le brouillon si le journal d’audit échoue (même transaction)', function () {
    app()->instance(Audit::class, new class extends Audit
    {
        public function record(?StaffUser $actor, string $action, ?string $subjectType = null, ?string $subjectId = null, ?array $before = null, ?array $after = null): void
        {
            throw new RuntimeException('journal indisponible');
        }
    });

    expect(fn () => legalService()->saveDraft(Seed::staff('admin'), ['contact_privacy_email' => ['fr' => 'a']]))->toThrow(RuntimeException::class);
    expect(DB::table('site_legal_fields')->count())->toBe(0);
});
