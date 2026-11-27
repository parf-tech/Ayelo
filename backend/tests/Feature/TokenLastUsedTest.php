<?php

use App\Models\User;
use Illuminate\Support\Facades\DB;

/*
 * Date de dernière utilisation d'un jeton : écrite au plus une fois par tranche de cinq minutes, au lieu d'une écriture en
 * base à chaque requête (profil du banc de charge). Ses lecteurs (purge des comptes jamais vérifiés, reprise d'une adresse
 * squattée) raisonnent en heures et en jours.
 */

function appelAvecJeton(string $jeton): void
{
    // Sans cela, le gardien garde l'utilisateur de la requête précédente et ne relit pas le jeton.
    app('auth')->forgetGuards();
    test()->withHeader('Authorization', 'Bearer '.$jeton)->getJson('/api/v1/me')->assertOk();
}

function derniereUtilisation(): ?string
{
    return DB::table('personal_access_tokens')->value('last_used_at');
}

/** Nombre d'écritures sur les jetons pendant l'action. */
function ecrituresDeJeton(Closure $action): int
{
    DB::flushQueryLog();
    DB::enableQueryLog();
    $action();
    $log = DB::getQueryLog();
    DB::disableQueryLog();

    return count(array_filter($log, fn (array $q): bool => str_starts_with($q['query'], 'update "personal_access_tokens"')));
}

beforeEach(function () {
    $this->freezeSecond();
    $this->jeton = User::factory()->create()->createToken('appareil-essai')->plainTextToken;
});

it('note la première utilisation d\'un jeton', function () {
    expect(derniereUtilisation())->toBeNull();

    expect(ecrituresDeJeton(fn () => appelAvecJeton($this->jeton)))->toBe(1)
        ->and(derniereUtilisation())->not->toBeNull();
});

it('n\'écrit plus rien pendant les cinq minutes qui suivent', function () {
    appelAvecJeton($this->jeton);
    $premiere = derniereUtilisation();

    $this->travel(299)->seconds();

    expect(ecrituresDeJeton(fn () => appelAvecJeton($this->jeton)))->toBe(0)
        ->and(derniereUtilisation())->toBe($premiere);
});

it('rafraîchit la date une fois la tranche écoulée', function () {
    appelAvecJeton($this->jeton);
    $premiere = derniereUtilisation();

    $this->travel(300)->seconds();

    expect(ecrituresDeJeton(fn () => appelAvecJeton($this->jeton)))->toBe(1)
        ->and(derniereUtilisation())->toBeGreaterThan($premiere);
});

it('enregistre toujours les autres changements d\'un jeton', function () {
    appelAvecJeton($this->jeton);
    $token = User::first()->tokens()->first();

    $token->forceFill(['name' => 'renomme', 'last_used_at' => now()])->save();

    expect(DB::table('personal_access_tokens')->value('name'))->toBe('renomme');
});

it('refuse toujours un jeton supprimé, même utilisé à l\'instant', function () {
    appelAvecJeton($this->jeton);
    DB::table('personal_access_tokens')->delete();

    app('auth')->forgetGuards();
    $this->withHeader('Authorization', 'Bearer '.$this->jeton)->getJson('/api/v1/me')->assertUnauthorized();
});
