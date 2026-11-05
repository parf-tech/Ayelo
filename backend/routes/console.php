<?php

use App\Services\AccountDeletion;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('accounts:purge', function (AccountDeletion $deletion) {
    $this->info('Comptes anonymisés : '.$deletion->purgeDue());
})->purpose('Anonymise les comptes dont le délai de suppression de 30 jours est écoulé');

Schedule::command('accounts:purge')->dailyAt('03:15')->onOneServer();

Artisan::command('calls:expire', function (App\Services\Calls $calls) {
    $r = $calls->expire();
    $this->info("Appels manqués : {$r['missed']}, terminés (durée maximale) : {$r['ended']}");
})->purpose('Marque les appels sans réponse comme manqués et termine ceux de plus de 20 minutes');

Schedule::command('calls:expire')->everyMinute()->withoutOverlapping();
