<?php

namespace App\Services\Admin;

use App\Models\StaffUser;
use DomainException;
use Illuminate\Support\Str;

/**
 * Comptes du personnel, côté console uniquement (aucune inscription publique).
 * Le mot de passe en clair n'est jamais journalisé : seul l'appelant (la commande) le reçoit, une fois.
 */
class StaffAccounts
{
    public function __construct(private Audit $audit) {}

    public function generatePassword(): string
    {
        return Str::password(20, symbols: false);
    }

    /** Opérateur de la console (variable STAFF_OPERATOR) : tracé dans le journal, sinon l'action reste sans acteur (revue N-13). */
    private function operator(): ?string
    {
        $operator = trim((string) config('app.staff_operator'));

        return $operator === '' ? null : mb_substr($operator, 0, 190);
    }

    public function create(string $email, string $role, string $password): StaffUser
    {
        $email = strtolower(trim($email));
        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new DomainException('Adresse e-mail invalide.');
        }
        if (! in_array($role, StaffUser::ROLES, true)) {
            throw new DomainException('Rôle inconnu (moderator, support, admin).');
        }
        if (mb_strlen($password) < 12) {
            throw new DomainException('Le mot de passe doit contenir au moins 12 caractères.');
        }
        if (StaffUser::where('email', $email)->exists()) {
            throw new DomainException('Ce compte existe déjà.');
        }

        $staff = StaffUser::create(['email' => $email, 'password' => $password, 'role' => $role, 'is_active' => true]);
        $this->audit->record(null, 'staff.created', 'staff_users', $staff->id, null, ['email' => $email, 'role' => $role] + ($this->operator() ? ['operator' => $this->operator()] : []));

        return $staff;
    }

    /**
     * Enrôle un nouveau secret TOTP (créé par la console, jamais choisi à la première connexion : revue N-05).
     *
     * @return array{secret: string, uri: string}
     */
    public function enrollTwoFactor(StaffUser $staff): array
    {
        $google2fa = new \PragmaRX\Google2FA\Google2FA;
        $secret = $google2fa->generateSecretKey();
        $staff->saveAppAuthenticationSecret($secret);

        return ['secret' => $secret, 'uri' => $google2fa->getQRCodeUrl('Ayelo', $staff->email, $secret)];
    }

    /**
     * Perte du téléphone : remplace la 2FA par un NOUVEAU secret, créé ici (sinon le mot de passe seul permettrait
     * d'enrôler son propre appareil à la prochaine connexion). Les codes de secours sont effacés.
     *
     * @return array{staff: StaffUser, secret: string, uri: string}
     */
    public function resetTwoFactor(string $email): array
    {
        $staff = StaffUser::where('email', strtolower(trim($email)))->first() ?? throw new DomainException('Compte introuvable.');
        $staff->forceFill(['recovery_codes_encrypted' => null])->save();
        $enrolled = $this->enrollTwoFactor($staff);
        $this->audit->record(null, 'staff.2fa_reset', 'staff_users', $staff->id, null, $this->operator() ? ['operator' => $this->operator()] : null);

        return ['staff' => $staff] + $enrolled;
    }
}
