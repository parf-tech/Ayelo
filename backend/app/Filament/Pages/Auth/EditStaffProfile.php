<?php

namespace App\Filament\Pages\Auth;

use App\Services\Admin\Audit;
use Filament\Auth\Pages\EditProfile;
use Filament\Facades\Filament;
use Filament\Schemas\Schema;

/**
 * Profil du personnel : mot de passe et 2FA (configuration, codes de secours) uniquement.
 * L'e-mail et le rôle ne se changent pas ici (aucun auto-octroi de droits).
 */
class EditStaffProfile extends EditProfile
{
    public function form(Schema $schema): Schema
    {
        return $schema->components([
            $this->getPasswordFormComponent()->minLength(12),
            $this->getPasswordConfirmationFormComponent(),
            $this->getCurrentPasswordFormComponent(),
        ]);
    }

    protected function afterSave(): void
    {
        app(Audit::class)->record($this->getUser(), 'staff.password_changed', 'staff_users', (string) $this->getUser()->getKey());
    }

    protected function getCurrentPasswordFormComponent(): \Filament\Schemas\Components\Component
    {
        return parent::getCurrentPasswordFormComponent()
            ->visible(fn (\Filament\Schemas\Components\Utilities\Get $get): bool => filled($get('password')));
    }
}
