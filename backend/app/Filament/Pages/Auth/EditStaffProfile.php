<?php

namespace App\Filament\Pages\Auth;

use App\Filament\Support\Staff;
use App\Services\Admin\Audit;
use Filament\Auth\Pages\EditProfile;
use Filament\Forms\Components\Select;
use Filament\Schemas\Components\Component;
use Filament\Schemas\Components\Utilities\Get;
use Filament\Schemas\Schema;

/**
 * Profil du personnel : langue du back-office, mot de passe et 2FA (configuration, codes de secours) uniquement.
 * L'e-mail et le rôle ne se changent pas ici (aucun auto-octroi de droits).
 */
class EditStaffProfile extends EditProfile
{
    private bool $passwordChanged = false;

    private ?string $previousLocale = null;

    public function form(Schema $schema): Schema
    {
        return $schema->components([
            // Langue choisie par la personne ; vide = réglage du serveur (ADMIN_LOCALE). Jamais déduite du navigateur.
            Select::make('locale')->label(Staff::t('admin.field.language'))
                ->options(['fr' => 'Français', 'en' => 'English'])->placeholder(Staff::t('admin.misc.default_language')),
            $this->getPasswordFormComponent()->minLength(12),
            $this->getPasswordConfirmationFormComponent(),
            $this->getCurrentPasswordFormComponent(),
        ]);
    }

    /** @param  array<string, mixed>  $data */
    protected function mutateFormDataBeforeSave(array $data): array
    {
        $this->passwordChanged = filled($data['password'] ?? null);
        $this->previousLocale = $this->getUser()->locale;
        $data['locale'] = filled($data['locale'] ?? null) ? $data['locale'] : null;

        return $data;
    }

    /** Ne trace que ce qui a changé : un changement de langue n'est pas un changement de mot de passe. */
    protected function afterSave(): void
    {
        $user = $this->getUser();
        $audit = app(Audit::class);

        if ($this->passwordChanged) {
            $audit->record($user, 'staff.password_changed', 'staff_users', (string) $user->getKey());
        }
        if ($user->locale !== $this->previousLocale) {
            $audit->record($user, 'staff.locale_changed', 'staff_users', (string) $user->getKey(), ['locale' => $this->previousLocale], ['locale' => $user->locale]);
        }
    }

    protected function getCurrentPasswordFormComponent(): Component
    {
        return parent::getCurrentPasswordFormComponent()
            ->visible(fn (Get $get): bool => filled($get('password')));
    }
}
