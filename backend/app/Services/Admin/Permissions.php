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

    /** Un compte désactivé n'a plus aucun droit, même avec une session ouverte. */
    public static function can(?StaffUser $staff, string $ability): bool
    {
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
