<?php

namespace App\Http\Controllers\Auth;

use App\Models\User;
use App\Services\AccountDeletion;

/**
 * Statut du compte au moment d'une connexion réussie (mot de passe ou fournisseur vérifié), commun à /auth/login et
 * /auth/oauth/{provider}.
 *
 * La décision est rendue sous forme de texte et les réponses 403 restent écrites dans chaque contrôleur : le générateur du
 * contrat OpenAPI lit les `return response()->json(...)` et perd les autres réponses de la route face à un `return $variable`.
 */
trait ChecksAccountStatus
{
    /**
     * Un compte suspendu ou banni peut se connecter : le jeton est restreint par EnsureAccountActive (sanctions, contestation,
     * export, suppression). Un compte supprimé ne le peut pas.
     *
     * Un compte en cours de suppression, dans son délai de grâce : `deletion_pending` tant que la personne n'a pas demandé
     * l'annulation (`cancel_deletion`) ; avec elle, la suppression est annulée ici et la connexion continue ($user est mis à jour).
     * L'annulation n'a jamais lieu par surprise. Les identifiants ont déjà été vérifiés par l'appelant : rien n'est révélé avant.
     *
     * @return 'allowed'|'deletion_pending'|'account_restricted'
     */
    protected function signInDecision(User $user, bool $cancelDeletion, AccountDeletion $deletion): string
    {
        if ($deletion->isCancellable($user)) {
            if (! $cancelDeletion) {
                return 'deletion_pending';
            }
            if (! $deletion->cancel($user)) {
                return 'account_restricted';
            }
            $user->refresh();
        }

        return in_array($user->getAttribute('status'), ['active', 'suspended', 'banned'], true) ? 'allowed' : 'account_restricted';
    }
}
