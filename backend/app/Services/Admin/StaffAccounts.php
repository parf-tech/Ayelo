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
        $this->audit->record(null, 'staff.created', 'staff_users', $staff->id, null, ['email' => $email, 'role' => $role]);

        return $staff;
    }

    /** Perte du téléphone : efface la 2FA ; elle devra être reconfigurée à la prochaine connexion. */
    public function resetTwoFactor(string $email): StaffUser
    {
        $staff = StaffUser::where('email', strtolower(trim($email)))->first() ?? throw new DomainException('Compte introuvable.');
        $staff->forceFill(['totp_secret_encrypted' => null, 'recovery_codes_encrypted' => null])->save();

        return $staff;
    }
}
