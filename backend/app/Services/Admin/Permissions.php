<?php

namespace App\Services\Admin;

use App\Models\StaffUser;
use Illuminate\Auth\Access\AuthorizationException;

/**
 * Matrice des droits du personnel (docs/11 : modérateur, support, administrateur).
 * Source unique : lue par les politiques Filament ET par les services d'administration (défense en profondeur).
 */
final class Permissions
{
    public const MEDIA_MODERATE = 'media.moderate';

    public const REPORTS_REVIEW = 'reports.review';

    public const APPEALS_REVIEW = 'appeals.review';

    public const VERIFICATIONS_REVIEW = 'verifications.review';

    public const SELFIE_VIEW = 'verifications.selfie';

    public const USERS_VIEW = 'users.view';

    public const USERS_MANAGE = 'users.manage';

    public const CREDITS_ADJUST = 'credits.adjust';

    public const PREMIUM_GRANT = 'premium.grant';

    public const TICKETS_MANAGE = 'tickets.manage';

    public const AUDIT_VIEW = 'audit.view';

    /** @var array<string, list<string>> */
    private const MATRIX = [
        StaffUser::ROLE_MODERATOR => [
            self::MEDIA_MODERATE, self::REPORTS_REVIEW, self::APPEALS_REVIEW, self::VERIFICATIONS_REVIEW, self::SELFIE_VIEW,
        ],
        StaffUser::ROLE_SUPPORT => [
            self::TICKETS_MANAGE, self::USERS_VIEW,
        ],
        StaffUser::ROLE_ADMIN => [
            self::MEDIA_MODERATE, self::REPORTS_REVIEW, self::APPEALS_REVIEW, self::VERIFICATIONS_REVIEW, self::SELFIE_VIEW,
            self::USERS_VIEW, self::USERS_MANAGE, self::CREDITS_ADJUST, self::PREMIUM_GRANT, self::TICKETS_MANAGE, self::AUDIT_VIEW,
        ],
    ];

    public const SELFIE_OPENS = 'selfie';

    public const REJECT_ONLY = 'reject_only';

    /**
     * Décision explicite sur le selfie (donnée biométrique) pour CHAQUE rôle qui détient `verifications.review` (revue N-09) :
     * - SELFIE_OPENS : le rôle détient aussi `verifications.selfie` ; il peut ouvrir le selfie, donc approuver (l'approbation exige
     *   une consultation journalisée du même acteur) et rejeter ;
     * - REJECT_ONLY : le rôle ne voit jamais le selfie ; il peut seulement rejeter (approuver exige d'avoir ouvert le selfie).
     * Ajouter `verifications.review` à un rôle sans l'inscrire ici (ou contredire cette table dans la matrice) fait échouer
     * `violations()` : au premier appel de `can()` (LogicException) et dans le test `SecurityHardeningRound9Test`.
     *
     * @var array<string, string>
     */
    public const SELFIE_POLICY = [
        StaffUser::ROLE_MODERATOR => self::SELFIE_OPENS,
        StaffUser::ROLE_ADMIN => self::SELFIE_OPENS,
    ];

    private static bool $invariantsChecked = false;

    /**
     * Invariants de la matrice (liste vide = conforme). Paramètres surchargeables pour que les tests prouvent la détection.
     *
     * @param  array<string, list<string>>|null  $matrix
     * @param  array<string, string>|null  $policy
     * @return list<string>
     */
    public static function violations(?array $matrix = null, ?array $policy = null): array
    {
        $matrix ??= self::MATRIX;
        $policy ??= self::SELFIE_POLICY;
        $found = [];
        foreach ($matrix as $role => $abilities) {
            $review = in_array(self::VERIFICATIONS_REVIEW, $abilities, true);
            $selfie = in_array(self::SELFIE_VIEW, $abilities, true);
            $decision = $policy[$role] ?? null;
            if ($review && ! in_array($decision, [self::SELFIE_OPENS, self::REJECT_ONLY], true)) {
                $found[] = "{$role} : verifications.review sans décision explicite sur verifications.selfie.";
            }
            if ($review && $decision === self::SELFIE_OPENS && ! $selfie) {
                $found[] = "{$role} : décision « selfie » mais verifications.selfie absent de la matrice.";
            }
            if ($review && $decision === self::REJECT_ONLY && $selfie) {
                $found[] = "{$role} : décision « reject_only » mais verifications.selfie présent dans la matrice.";
            }
            if (! $review && $selfie) {
                $found[] = "{$role} : verifications.selfie sans verifications.review.";
            }
        }
        foreach (array_keys($policy) as $role) {
            if (! isset($matrix[$role])) {
                $found[] = "{$role} : décision sur le selfie pour un rôle inconnu.";
            }
        }

        return $found;
    }

    private static function assertInvariants(): void
    {
        if (self::$invariantsChecked) {
            return;
        }
        $found = self::violations();
        if ($found !== []) {
            throw new \LogicException('Matrice des droits incohérente : '.implode(' ', $found));
        }
        self::$invariantsChecked = true;
    }

    /** Un compte désactivé n'a plus aucun droit, même avec une session ouverte. */
    public static function can(?StaffUser $staff, string $ability): bool
    {
        self::assertInvariants();

        if ($staff === null || $staff->is_active !== true) {
            return false;
        }

        return in_array($ability, self::MATRIX[$staff->role] ?? [], true);
    }

    /** @throws AuthorizationException */
    public static function authorize(?StaffUser $staff, string $ability): void
    {
        if (! self::can($staff, $ability)) {
            throw new AuthorizationException("Droit insuffisant : {$ability}.");
        }
    }

    /** @return list<string> */
    public static function for(string $role): array
    {
        return self::MATRIX[$role] ?? [];
    }
}
