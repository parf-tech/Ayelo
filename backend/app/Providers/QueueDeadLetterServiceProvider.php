<?php

namespace App\Providers;

use Illuminate\Queue\Events\JobFailed;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\ServiceProvider;

/**
 * Dead-letter des tâches en file : un travail qui échoue définitivement est consigné dans `failed_jobs` (par Laravel)
 * et signalé ici au niveau « critical ». Seuls le nom du travail et la classe de l'exception sont journalisés :
 * ni charge utile, ni message d'exception (peut contenir des données personnelles).
 * La purge des lignes `failed_jobs` est planifiée dans routes/console.php (queue:prune-failed).
 */
class QueueDeadLetterServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Queue::failing(function (JobFailed $event): void {
            Log::critical('Tâche en file échouée', [
                'job' => $event->job->resolveName(),
                'connection' => $event->connectionName,
                'exception' => $event->exception::class,
            ]);
        });
    }
}
