<?php

namespace App\Filament\Commands;

use App\Services\Admin\StaffAccounts;
use DomainException;
use Illuminate\Console\Command;

/** Perte du téléphone d'un membre du personnel : remplace sa 2FA par un nouveau secret affiché une fois (jamais d'enrôlement à la connexion). Journalisé. */
class StaffResetTwoFactorCommand extends Command
{
    protected $signature = 'staff:reset-2fa {email : Adresse e-mail du compte}';

    protected $description = 'Efface la double authentification d\'un compte du personnel';

    public function handle(StaffAccounts $accounts): int
    {
        try {
            $reset = $accounts->resetTwoFactor((string) $this->argument('email'));
        } catch (DomainException $e) {
            $this->components->error($e->getMessage());

            return self::FAILURE;
        }

        $this->components->info("2FA remplacée pour {$reset['staff']->email} (codes de secours effacés).");
        $this->line('Nouveau secret TOTP (affiché une seule fois) :');
        $this->line($reset['secret']);
        $this->line('URI : '.$reset['uri']);

        return self::SUCCESS;
    }
}
