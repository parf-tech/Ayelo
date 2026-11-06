<?php

namespace App\Filament\Commands;

use App\Services\Admin\StaffAccounts;
use DomainException;
use Illuminate\Console\Command;

/** Perte du téléphone d'un membre du personnel : efface sa 2FA (à reconfigurer à la prochaine connexion). Journalisé. */
class StaffResetTwoFactorCommand extends Command
{
    protected $signature = 'staff:reset-2fa {email : Adresse e-mail du compte}';

    protected $description = 'Efface la double authentification d\'un compte du personnel';

    public function handle(StaffAccounts $accounts): int
    {
        try {
            $staff = $accounts->resetTwoFactor((string) $this->argument('email'));
        } catch (DomainException $e) {
            $this->components->error($e->getMessage());

            return self::FAILURE;
        }

        $this->components->info("2FA effacée pour {$staff->email}.");

        return self::SUCCESS;
    }
}
