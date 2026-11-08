<?php

namespace App\Jobs;

use App\Services\Push\PushNotifier;
use App\Services\Push\RetryablePushException;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Envoie une notification à tous les appareils d'un utilisateur, selon ses préférences.
 *
 * - File `push` (worker dédié ou `--queue=push,default`) : une panne FCM ne retarde ni les diffusions ni les fermetures de salle.
 * - P-14 : pour un message, la tâche transporte l'identifiant du message, jamais son texte. Le corps est construit au moment
 *   de l'envoi (aperçu seulement si `push.message_preview`) ; `$body` ne sert alors que de texte générique de repli.
 * - Pas de doublon : `ShouldBeUnique` (un seul exemplaire en attente par utilisateur + message ou appel) et, lors d'un réessai,
 *   les appareils déjà notifiés ne le sont pas une seconde fois.
 * - Réessais : 5 essais, délais 10 s, 1 min, 5 min, 15 min sur 5xx / 429 / délai dépassé (RetryablePushException).
 */
class SendPush implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $tries = 5;

    /** Durée maximale du verrou d'unicité (secondes) si la tâche ne se termine jamais. */
    public int $uniqueFor = 3600;

    /** Clé d'idempotence : utilisateur + message ou appel ; aléatoire (donc jamais dédoublonnée) sans identifiant métier. */
    public string $dedupeKey;

    /**
     * @param  string  $kind  messages | matches | calls (colonne push_* de notification_prefs)
     * @param  array<string, string>  $data  identifiants uniquement (conversation_id, call_id, type)
     * @param  string|null  $messageId  message à annoncer : le texte est lu à l'envoi, pas transporté dans la file
     */
    public function __construct(public string $userId, public string $kind, public string $title, public string $body, public array $data = [], public ?string $messageId = null)
    {
        $this->onQueue('push');
        $business = $messageId !== null ? 'msg:'.$messageId : (isset($data['call_id']) ? 'call:'.$data['call_id'] : null);
        $this->dedupeKey = $business !== null ? $this->userId.':'.$this->kind.':'.$business : (string) Str::uuid();
    }

    /** @return list<int> secondes avant chaque nouvel essai */
    public function backoff(): array
    {
        return [10, 60, 300, 900];
    }

    public function uniqueId(): string
    {
        return $this->dedupeKey;
    }

    public function handle(PushNotifier $push): void
    {
        $prefs = DB::table('notification_prefs')->where('user_id', $this->userId)->first();
        $column = 'push_'.$this->kind;
        if ($prefs !== null && property_exists($prefs, $column) && ! $prefs->{$column}) {
            return;
        }

        // Un compte suspendu, banni ou en cours de suppression ne reçoit plus d'aperçu de message ni d'appel (revue S9) :
        // les jetons ne sont plus révoqués à la sanction (N-02), le filtre doit donc être ici.
        if (DB::table('users')->where('id', $this->userId)->value('status') !== 'active') {
            return;
        }

        $body = $this->body;
        if ($this->messageId !== null) {
            $message = DB::table('messages')->where('id', $this->messageId)->first(['type', 'body', 'deleted_at']);
            if ($message === null || $message->deleted_at !== null) {
                return; // message supprimé entre l'envoi et la notification : rien à annoncer
            }
            $body = $this->messageBody($message);
        }

        $devices = DB::table('devices')->where('user_id', $this->userId)->whereNotNull('push_token')->get(['id', 'platform', 'push_token']);

        $retry = false;
        foreach ($devices as $device) {
            $sentKey = 'push.sent.'.$this->dedupeKey.'.'.$device->id;
            if (Cache::has($sentKey)) {
                continue; // déjà notifié lors d'un essai précédent de cette tâche
            }

            try {
                $valid = $push->send($device->platform, $device->push_token, $this->title, $body, $this->data);
            } catch (RetryablePushException) {
                $retry = true;

                continue;
            }

            if (! $valid) {
                // Jeton invalide ou désinstallé (404, INVALID_ARGUMENT) : on l'efface, sauf s'il vient d'être remplacé.
                DB::table('devices')->where('id', $device->id)->where('push_token', $device->push_token)->update(['push_token' => null, 'updated_at' => now()]);
            } else {
                Cache::put($sentKey, 1, 3600);
            }
        }

        if ($retry) {
            $this->retryLater();
        }
    }

    /** Remet la tâche dans la file avec le délai de l'essai en cours, tant qu'il reste des essais. Aucun texte ni jeton dans le journal. */
    private function retryLater(): void
    {
        $attempt = $this->job !== null ? $this->job->attempts() : 1;
        if ($attempt >= $this->tries) {
            Log::warning('push abandonné après les réessais', ['kind' => $this->kind, 'attempts' => $attempt]);

            return;
        }

        $delays = $this->backoff();
        $this->release($delays[min($attempt - 1, count($delays) - 1)]);
    }

    private function messageBody(object $message): string
    {
        if (! config('push.message_preview')) {
            return $this->body;
        }

        return $message->type === 'text'
            ? Str::limit((string) $message->body, (int) config('push.message_preview_chars', 80))
            : 'Média reçu';
    }
}
