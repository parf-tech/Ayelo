<?php

use App\Services\AccountDeletion;
use App\Services\Calls;
use App\Services\RevenueCatProcessor;
use App\Services\Storage\MediaStorage;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schedule;

Artisan::command('accounts:purge', function (AccountDeletion $deletion) {
    $this->info('Comptes anonymisés : '.$deletion->purgeDue());
})->purpose('Anonymise les comptes dont le délai de suppression de 30 jours est écoulé');

Schedule::command('accounts:purge')->dailyAt('03:15')->onOneServer();

Artisan::command('accounts:purge-unverified', function (AccountDeletion $deletion) {
    $this->info('Comptes jamais vérifiés anonymisés : '.$deletion->purgeUnverified());
})->purpose('Anonymise les comptes créés par e-mail, jamais vérifiés et inactifs depuis retention.unverified_account_days jours');

Schedule::command('accounts:purge-unverified')->dailyAt('03:30')->onOneServer();

// Rattrape tout écart des compteurs dénormalisés (non lus, dernier message, soldes de crédits) ; une correction est journalisée.
Schedule::command('counters:reconcile --fix')->dailyAt('03:45')->onOneServer();

Artisan::command('calls:expire', function (Calls $calls) {
    $r = $calls->expire();
    $this->info("Appels manqués : {$r['missed']}, terminés (durée maximale) : {$r['ended']}");
})->purpose('Marque les appels sans réponse comme manqués et termine ceux de plus de 20 minutes');

Schedule::command('calls:expire')->everyMinute()->withoutOverlapping();

Artisan::command('media:purge-pending', function (MediaStorage $storage) {
    $old = DB::table('media')->where('status', 'pending_upload')->where('created_at', '<=', now()->subHours((int) config('media.pending_ttl_hours')))->get();
    foreach ($old as $m) {
        $storage->delete($m->storage_key);
    }
    DB::table('media')->whereIn('id', $old->pluck('id'))->delete();
    // Selfies dont la suppression a échoué après la décision (ProfileVerification : purge_after renseigné, statut « purged »).
    $retried = 0;
    foreach (DB::table('media')->where('kind', 'verification_selfie')->where('status', 'purged')->whereNotNull('purge_after')->limit(500)->get() as $m) {
        try {
            $storage->delete($m->storage_key);
            DB::table('media')->where('id', $m->id)->update(['purge_after' => null]);
            $retried++;
        } catch (Throwable $e) {
            report($e);
        }
    }
    $this->info('Dépôts abandonnés supprimés : '.$old->count().', selfies repris : '.$retried);
})->purpose('Supprime les envois de médias jamais finalisés');

// Revue pentest P-07 : la taille d'un dépôt présigné (PUT) n'est pas liée par la signature. Un objet en attente plus gros que le
// plafond de son type, ou que la taille déclarée, est supprimé avec sa ligne (`complete` refuserait de toute façon).
Artisan::command('media:purge-oversized', function (MediaStorage $storage) {
    $removed = 0;
    // Les dépôts les PLUS RÉCENTS d'abord (un attaquant dépose en continu : les plus anciens ont de toute façon expiré), par
    // lots de 500 en pagination par clé (created_at, id) décroissante - stable même si des lignes sont supprimées en route.
    $since = now()->subHours((int) config('media.pending_ttl_hours'));
    $budget = (int) config('media.purge_oversized_max', 2000);
    $cursor = null;
    while ($budget > 0) {
        $query = DB::table('media')->where('status', 'pending_upload')->where('created_at', '>=', $since)
            ->orderByDesc('created_at')->orderByDesc('id')->limit(min(500, $budget));
        if ($cursor !== null) {
            $query->whereRaw('(created_at, id) < (?, ?)', [$cursor->created_at, $cursor->id]);
        }
        $rows = $query->get(['id', 'kind', 'storage_key', 'size_bytes', 'created_at']);
        if ($rows->isEmpty()) {
            break;
        }
        foreach ($rows as $m) {
            try {
                $head = $storage->head($m->storage_key);
                $max = (int) config('media.kinds.'.$m->kind.'.max_bytes');
                if ($head !== null && ($head['size'] > $max || $head['size'] !== (int) $m->size_bytes)) {
                    $storage->delete($m->storage_key);
                    DB::table('media')->where('id', $m->id)->where('status', 'pending_upload')->delete();
                    $removed++;
                }
            } catch (Throwable $e) {
                report($e);
            }
        }
        $budget -= $rows->count();
        $cursor = $rows->last();
    }
    $this->info('Dépôts hors norme supprimés : '.$removed);
})->purpose('Supprime les dépôts en attente dont la taille dépasse le plafond ou la taille déclarée');

Schedule::command('media:purge-oversized')->everyFiveMinutes()->withoutOverlapping();

Artisan::command('exports:purge', function (MediaStorage $storage) {
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
Artisan::command('media:sweep-orphans {--dry-run : Compter sans supprimer}', function (MediaStorage $storage) {
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

Artisan::command('billing:replay-unknown', function (RevenueCatProcessor $processor) {
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

// Dead-letter : les tâches échouées (table failed_jobs) sont gardées 7 jours pour diagnostic puis purgées.
Schedule::command('queue:prune-failed --hours=168')->daily()->onOneServer();
