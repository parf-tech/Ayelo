<?php

namespace App\Models;

use Laravel\Sanctum\PersonalAccessToken as SanctumPersonalAccessToken;

/**
 * Jeton Sanctum dont la date de dernière utilisation n'est écrite qu'une fois par tranche de {@see self::LAST_USED_SECONDS}
 * secondes. Sanctum l'écrit à chaque requête authentifiée (une écriture en base par appel). Les lecteurs de cette date (purge
 * des comptes jamais vérifiés, reprise d'une adresse squattée) raisonnent en heures et en jours.
 */
class PersonalAccessToken extends SanctumPersonalAccessToken
{
    public const LAST_USED_SECONDS = 300;

    /** @param  array<string, mixed>  $options */
    public function save(array $options = []): bool
    {
        if ($this->exists && array_keys($this->getDirty()) === ['last_used_at']) {
            $previous = $this->getOriginal('last_used_at');
            if ($previous !== null && $this->asDateTime($previous)->gt(now()->subSeconds(self::LAST_USED_SECONDS))) {
                return true;
            }
        }

        return parent::save($options);
    }
}
