<?php

namespace App\Filament\Commands;

use App\Services\Admin\StaffAccounts;
use DomainException;
use Illuminate\Console\Command;

use function Laravel\Prompts\password;

/**
 * Crée un compte du personnel (premier administrateur compris). Le mot de passe n'est jamais passé en argument
 * (historique du shell) : il est généré et affiché UNE fois, ou saisi en masqué avec --prompt.
 * Il n'est jamais écrit dans les journaux ni dans le journal d'audit. La 2FA est enrôlée à la création (secret affiché seulement avec --show-secret).
 */
class StaffCreateCommand extends Command
{
    protected $signature = 'staff:create {email : Adresse e-mail du compte} {role : moderator, support ou admin} {--prompt : Saisir le mot de passe (masqué) au lieu d\'en générer un} {--show-secret : Afficher aussi le secret 2FA (sinon : staff:reset-2fa dans une session distincte)}';

    protected $description = 'Crée un compte du personnel d\'administration (mot de passe affiché une seule fois)';

    public function handle(StaffAccounts $accounts): int
    {
        // Refus avant toute saisie ou génération de mot de passe si la production n'a pas d'opérateur déclaré (revue N-13).
        try {
            $accounts->assertOperatorDeclared();
        } catch (DomainException $e) {
            $this->components->error($e->getMessage());

            return self::FAILURE;
        }

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

        // La double authentification est enrôlée DÈS LA CRÉATION : sans cela, quiconque connaîtrait le mot de passe pourrait
        // enrôler son propre appareil à la première connexion (revue N-05).
        $enrolled = $accounts->enrollTwoFactor($staff);

        $this->components->info("Compte créé : {$staff->email} (rôle {$staff->role}).");
        if ($generated) {
            $this->line('Mot de passe (affiché une seule fois, à changer et à noter dans un gestionnaire de mots de passe) :');
            $this->line($plain);
        }
        // Mot de passe et secret 2FA ne partagent pas la même sortie par défaut : une capture du terminal les donnerait ensemble.
        if ($this->option('show-secret')) {
            $this->line('Double authentification : ajoutez ce secret dans une application TOTP (affiché une seule fois) :');
            $this->line($enrolled['secret']);
            $this->line('URI : '.$enrolled['uri']);
        } else {
            $this->line("Secret 2FA non affiché : lancez `php artisan staff:reset-2fa {$staff->email}` dans une session distincte pour l'obtenir (ou refaites la création avec --show-secret).");
        }

        return self::SUCCESS;
    }
}
