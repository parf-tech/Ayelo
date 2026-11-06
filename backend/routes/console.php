<?php

use App\Services\AccountDeletion;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
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

Artisan::command('media:purge-pending', function (App\Services\Storage\MediaStorage $storage) {
    $old = DB::table('media')->where('status', 'pending_upload')->where('created_at', '<=', now()->subHours((int) config('media.pending_ttl_hours')))->get();
    foreach ($old as $m) {
        $storage->delete($m->storage_key);
    }
    DB::table('media')->whereIn('id', $old->pluck('id'))->delete();
    $this->info('Dépôts abandonnés supprimés : '.$old->count());
})->purpose('Supprime les envois de médias jamais finalisés');

Artisan::command('exports:purge', function (App\Services\Storage\MediaStorage $storage) {
    $old = DB::table('data_exports')->where(fn ($q) => $q->where('expires_at', '<=', now())->orWhere('status', 'failed'))->get();
    foreach ($old as $e) {
        if ($e->storage_key) {
            $storage->delete($e->storage_key);
        }
    }
    DB::table('data_exports')->whereIn('id', $old->pluck('id'))->delete();
    $this->info('Exports supprimés : '.$old->count());
})->purpose('Supprime les exports de données expirés (objet et ligne)');

Schedule::command('media:purge-pending')->hourly();
Schedule::command('exports:purge')->dailyAt('03:30');

// Lève les suspensions à durée limitée arrivées à échéance (sinon le compte reste bloqué : voir specs/009).
Schedule::command('sanctions:expire')->everyMinute()->withoutOverlapping();
