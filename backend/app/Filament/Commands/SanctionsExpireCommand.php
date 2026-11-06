<?php

namespace App\Filament\Commands;

use App\Services\Admin\SanctionLedger;
use Illuminate\Console\Command;

/**
 * Réactive les comptes dont la suspension à durée limitée est arrivée à son terme. L'API refuse déjà la connexion
 * tant que le statut n'est pas « active » : sans cette commande, une suspension expirée resterait bloquante.
 * À planifier chaque minute (routes/console.php, hors du périmètre de ce lot).
 */
class SanctionsExpireCommand extends Command
{
    protected $signature = 'sanctions:expire';

    protected $description = 'Réactive les comptes dont la suspension a expiré';

    public function handle(SanctionLedger $sanctions): int
    {
        $this->components->info($sanctions->restoreExpired().' compte(s) réactivé(s).');

        return self::SUCCESS;
    }
}
