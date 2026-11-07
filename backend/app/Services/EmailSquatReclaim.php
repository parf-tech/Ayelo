<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Squat d'e-mail non vérifié (revue F-30) : s'inscrire avec l'adresse d'autrui bloquait son vrai propriétaire.
 * Un compte créé par e-mail, jamais vérifié, plus vieux que `safety.unverified_reclaim_hours` et sans activité depuis ce
 * délai (aucune connexion, aucun jeton utilisé) est anonymisé quand l'adresse est de nouveau présentée par un fournisseur
 * OAuth qui la PROUVE, ce qui libère l'adresse. Un compte vérifié, social, récent ou actif n'est jamais touché.
 *
 * À n'appeler QUE depuis un chemin où la possession de l'adresse est prouvée (OAuth). Jamais depuis le formulaire d'inscription :
 * une requête non authentifiée ne doit pas détruire le compte d'autrui (revue pentest P-01). Par formulaire, le propriétaire
 * reprend l'adresse via « mot de passe oublié » (le code part à l'adresse ; il marque aussi l'adresse comme vérifiée).
 */
class EmailSquatReclaim
{
    public function __construct(private AccountDeletion $deletion) {}

    /** @return bool true si un compte squatteur a été libéré */
    public function release(string $email): bool
    {
        $limit = now()->subHours(max(1, (int) config('safety.unverified_reclaim_hours', 24)));

        $existing = User::where('email', strtolower($email))->first();
        if ($existing === null || $existing->email_verified_at !== null || $existing->password === null || $existing->status !== 'active') {
            return false;
        }

        if ($existing->created_at->gt($limit) || ($existing->last_seen_at !== null && $existing->last_seen_at->gt($limit))) {
            return false;
        }

        if (DB::table('personal_access_tokens')->where('tokenable_id', $existing->id)->where('last_used_at', '>', $limit)->exists()) {
            return false;
        }

        try {
            $this->deletion->anonymize($existing);
        } catch (\Throwable $e) {
            report($e);

            return false;
        }

        return true;
    }
}
