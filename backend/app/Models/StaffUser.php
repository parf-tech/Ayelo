<?php

namespace App\Models;

use App\Services\Admin\Audit;
use Filament\Auth\MultiFactor\App\Contracts\HasAppAuthentication;
use Filament\Auth\MultiFactor\App\Contracts\HasAppAuthenticationRecovery;
use Filament\Models\Contracts\FilamentUser;
use Filament\Models\Contracts\HasName;
use Filament\Panel;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Foundation\Auth\User as Authenticatable;
use SensitiveParameter;

/**
 * Table `staff_users` : personnel d'administration, séparé des utilisateurs de l'application.
 * Authentifié par le garde « staff » ; n'a aucun lien avec Sanctum ni avec l'API mobile.
 *
 * La 2FA (application TOTP) est branchée sur les colonnes du schéma : le secret et les codes de secours sont
 * chiffrés avec la clé de l'application (cast `encrypted`) ; les codes de secours sont en plus hachés par Filament.
 *
 * Les migrations sont en SQL brut : les colonnes sont déclarées ici pour l'analyse statique.
 *
 * @property string $id
 * @property string $email
 * @property string $role
 * @property string|null $locale
 */
class StaffUser extends Authenticatable implements FilamentUser, HasAppAuthentication, HasAppAuthenticationRecovery, HasName
{
    use HasUuids;

    public const ROLE_MODERATOR = 'moderator';

    public const ROLE_SUPPORT = 'support';

    public const ROLE_ADMIN = 'admin';

    public const ROLES = [self::ROLE_MODERATOR, self::ROLE_SUPPORT, self::ROLE_ADMIN];

    protected $table = 'staff_users';

    // `locale` : préférence de langue du back-office, modifiable par la personne elle-même (profil) ; jamais le rôle ni l'e-mail.
    protected $fillable = ['email', 'password', 'role', 'is_active', 'last_login_at', 'locale'];

    /** Jamais exposés (sérialisation, formulaires, journaux). */
    protected $hidden = ['password', 'totp_secret_encrypted', 'recovery_codes_encrypted'];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'totp_secret_encrypted' => 'encrypted',
            'recovery_codes_encrypted' => 'encrypted:array',
            'is_active' => 'boolean',
            'last_login_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        // Toute modification de la 2FA (activation, désactivation, codes de secours, réinitialisation) est journalisée.
        static::updated(function (self $staff): void {
            $actor = auth('staff')->user();
            $audit = app(Audit::class);
            if ($staff->wasChanged('totp_secret_encrypted')) {
                $audit->record($actor instanceof self ? $actor : null, $staff->hasTwoFactor() ? 'staff.2fa_enabled' : 'staff.2fa_disabled', 'staff_users', (string) $staff->getKey());
            } elseif ($staff->wasChanged('recovery_codes_encrypted')) {
                $audit->record($actor instanceof self ? $actor : null, 'staff.2fa_recovery_codes_changed', 'staff_users', (string) $staff->getKey());
            }
        });
    }

    /** La table n'a pas de colonne remember_token : la reconnexion automatique est désactivée. */
    public function getRememberTokenName(): string
    {
        return '';
    }

    public function canAccessPanel(Panel $panel): bool
    {
        return $panel->getId() === 'admin' && $this->is_active === true && in_array($this->role, self::ROLES, true);
    }

    public function getFilamentName(): string
    {
        return (string) $this->email;
    }

    public function isAdmin(): bool
    {
        return $this->role === self::ROLE_ADMIN;
    }

    public function hasTwoFactor(): bool
    {
        return filled($this->totp_secret_encrypted);
    }

    // ---- 2FA (contrats Filament) ----

    public function getAppAuthenticationSecret(): ?string
    {
        return $this->totp_secret_encrypted;
    }

    public function saveAppAuthenticationSecret(#[SensitiveParameter] ?string $secret): void
    {
        $this->totp_secret_encrypted = $secret;
        $this->save();
    }

    public function getAppAuthenticationHolderName(): string
    {
        return (string) $this->email;
    }

    public function getAppAuthenticationRecoveryCodes(): ?array
    {
        return $this->recovery_codes_encrypted;
    }

    public function saveAppAuthenticationRecoveryCodes(#[SensitiveParameter] ?array $codes): void
    {
        $this->recovery_codes_encrypted = $codes;
        $this->save();
    }
}
