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

// Objets sans ligne `media` (échec entre l'écriture de l'objet et celle de la ligne, suppression partielle) : revue N-14.
// Seuls les objets de médias (`u/`) plus anciens que le délai de grâce sont supprimés ; les exports (`exports/`) ont leur propre purge.
Artisan::command('media:sweep-orphans {--dry-run : Compter sans supprimer}', function (App\Services\Storage\MediaStorage $storage) {
    $cutoff = now()->subHours((int) config('media.orphan_grace_hours'))->timestamp;
    $limit = (int) config('media.orphan_sweep_max');
    $dry = (bool) $this->option('dry-run');
    $found = 0;
    $batch = [];
    $flush = function () use (&$batch, &$found, $storage, $dry) {
        if ($batch === []) {
            return;
        }
        $known = DB::table('media')->whereIn('storage_key', $batch)->pluck('storage_key')->all();
        foreach (array_diff($batch, $known) as $orphan) {
            $found++;
            if (! $dry) {
                $storage->delete($orphan);
            }
        }
        $batch = [];
    };
    foreach ($storage->listObjects('u/') as $object) {
        if ($object['modified_at'] > $cutoff) {
            continue;
        }
        $batch[] = $object['key'];
        if (count($batch) >= 500) {
            $flush();
        }
        if ($found >= $limit) {
            break;
        }
    }
    $flush();
    $this->info(($dry ? 'Orphelins repérés : ' : 'Orphelins supprimés : ').$found);
})->purpose('Supprime les objets de médias sans ligne en base (au-delà du délai de grâce)');

Schedule::command('media:purge-pending')->hourly();
Schedule::command('media:sweep-orphans')->dailyAt('04:00')->onOneServer()->withoutOverlapping();
Schedule::command('exports:purge')->dailyAt('03:30');

// Lève les suspensions à durée limitée arrivées à échéance (sinon le compte reste bloqué : voir specs/009).
Schedule::command('sanctions:expire')->everyMinute()->withoutOverlapping();

Artisan::command('billing:replay-unknown', function (App\Services\RevenueCatProcessor $processor) {
    $done = 0;
    DB::table('webhook_events')->whereNull('processed_at')->where('error', 'utilisateur inconnu')->orderBy('created_at')->limit(500)->get()
        ->each(function ($row) use ($processor, &$done) {
            if ($processor->handle(json_decode($row->payload, true) ?: []) === 'processed') {
                $done++;
            }
        });
    $this->info("Événements rejoués : $done");
})->purpose('Rejoue les événements RevenueCat reçus avant que leur utilisateur existe');

Schedule::command('billing:replay-unknown')->everyFifteenMinutes()->withoutOverlapping();
