<?php

namespace App\Filament\Pages\Auth;

use Filament\Auth\Pages\Login;
use Filament\Schemas\Schema;
use SensitiveParameter;

/**
 * Connexion du personnel : les comptes désactivés (is_active = false) sont refusés dès la recherche des identifiants,
 * et il n'y a pas de « se souvenir de moi » (la table n'a pas de remember_token).
 */
class StaffLogin extends Login
{
    public function form(Schema $schema): Schema
    {
        return $schema->components([
            $this->getEmailFormComponent(),
            $this->getPasswordFormComponent(),
        ]);
    }

    protected function getCredentialsFromFormData(#[SensitiveParameter] array $data): array
    {
        return [
            'email' => $data['email'],
            'password' => $data['password'],
            'is_active' => true,
        ];
    }
}
