<?php

namespace App\Console\Commands;

use App\Support\DeployPreflight;
use Illuminate\Console\Command;

/**
 * `php artisan deploy:preflight` : refuse (code 1) une configuration de production incomplète. Appelé par infra/scripts/deploy.sh
 * avant la migration. N'affiche jamais de valeur, seulement le nom de la variable en défaut.
 */
class DeployPreflightCommand extends Command
{
    protected $signature = 'deploy:preflight';

    protected $description = 'Vérifie la configuration de production avant un déploiement (code 1 si une erreur bloquante)';

    public function handle(): int
    {
        $result = DeployPreflight::inspect();

        foreach ($result['warnings'] as $warning) {
            $this->warn('AVERTISSEMENT : '.$warning);
        }
        foreach ($result['errors'] as $error) {
            $this->error('ERREUR : '.$error);
        }

        if ($result['errors'] !== []) {
            $this->error(count($result['errors']).' erreur(s) bloquante(s) : déploiement refusé.');

            return self::FAILURE;
        }

        $this->info('Configuration de production valide'.($result['warnings'] === [] ? '.' : ' ('.count($result['warnings']).' avertissement(s)).'));

        return self::SUCCESS;
    }
}
