<?php

namespace App\Filament\Commands;

use App\Models\StaffUser;
use App\Services\Admin\StaffAccounts;
use DomainException;
use Illuminate\Console\Command;

use function Laravel\Prompts\password;

/**
 * Crée un compte du personnel (premier administrateur compris). Le mot de passe n'est jamais passé en argument
 * (historique du shell) : il est généré et affiché UNE fois, ou saisi en masqué avec --prompt.
 * Il n'est jamais écrit dans les journaux ni dans le journal d'audit. La 2FA se configure à la première connexion.
 */
class StaffCreateCommand extends Command
{
    protected $signature = 'staff:create {email : Adresse e-mail du compte} {role : moderator, support ou admin} {--prompt : Saisir le mot de passe (masqué) au lieu d\'en générer un}';

    protected $description = 'Crée un compte du personnel d\'administration (mot de passe affiché une seule fois)';

    public function handle(StaffAccounts $accounts): int
    {
        $generated = ! $this->option('prompt');
        $plain = $generated
            ? $accounts->generatePassword()
            : password('Mot de passe (12 caractères minimum)', required: true, validate: fn (string $v) => mb_strlen($v) < 12 ? '12 caractères minimum.' : null);

        try {
            $staff = $accounts->create((string) $this->argument('email'), (string) $this->argument('role'), $plain);
        } catch (DomainException $e) {
            $this->components->error($e->getMessage());

            return self::FAILURE;
        }

        $this->components->info("Compte créé : {$staff->email} (rôle {$staff->role}).");
        if ($generated) {
            $this->line('Mot de passe (affiché une seule fois, à changer et à noter dans un gestionnaire de mots de passe) :');
            $this->line($plain);
        }
        $this->line('La double authentification (application TOTP) sera à configurer à la première connexion sur /admin.');

        return self::SUCCESS;
    }
}
