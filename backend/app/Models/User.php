<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

/**
 * Table `users` du schéma de référence : clé uuid, birthdate non modifiable (déclencheur SQL).
 * Pas de colonne `name` ni `remember_token` : le nom d'affichage est dans `profiles`.
 */
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasUuids;

    /**
     * États qui gardent un accès au compte : connexion (restreinte par EnsureAccountActive pour un compte sanctionné),
     * réinitialisation du mot de passe et demande de suppression depuis le web (contestation et droit à l'effacement, N-02).
     */
    public const KEEPS_ACCESS = ['active', 'suspended', 'banned'];

    protected $fillable = [
        'email',
        'phone',
        'password',
        'birthdate',
        'locale',
    ];

    protected $hidden = [
        'password',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'phone_verified_at' => 'datetime',
            'last_seen_at' => 'datetime',
            'birthdate' => 'date',
            'password' => 'hashed',
        ];
    }
}
