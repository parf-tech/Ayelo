<?php

namespace App\Jobs;

use App\Services\Media\MediaDecisionNotifier;
use App\Services\Media\Transcoder;
use App\Services\Storage\MediaStorage;
use DateTimeInterface;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

/**
 * Traite une note vocale ou une vidéo de conversation entre la fin du dépôt (`transcoding`) et la revue humaine (`processing`).
 *
 * Le fichier déposé n'est jamais servi ni montré à un modérateur : il est remis au conteneur `transcode` (ffmpeg, sans réseau),
 * qui le réencode sans métadonnées. La tâche n'attend pas dans un worker : elle regarde le dossier partagé, puis se remet en
 * file toutes les `media.transcode.poll_seconds` jusqu'au résultat ou jusqu'à `media.transcode.timeout_seconds`.
 * Tout incident (fichier illisible, trop long, trop lourd, mauvais type, délai dépassé) refuse le média (« unreadable ») :
 * fichiers supprimés, expéditeur prévenu, motif jamais détaillé.
 */
class TranscodeChatMedia implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    /** Sans limite d'essais : chaque regard est une remise en file ; `retryUntil` borne la durée totale. */
    public int $tries = 0;

    public int $uniqueFor = 3600;

    /** Sorties attendues par type de traitement : type MIME et extension de la clé de stockage. */
    private const OUTPUT = ['audio' => ['audio/mp4', 'm4a'], 'video' => ['video/mp4', 'mp4']];

    public function __construct(public string $mediaId) {}

    public function uniqueId(): string
    {
        return $this->mediaId;
    }

    public function retryUntil(): DateTimeInterface
    {
        return now()->addSeconds((int) config('media.transcode.timeout_seconds') + 300);
    }

    public function handle(Transcoder $transcoder, MediaStorage $storage, MediaDecisionNotifier $notifier): void
    {
        $media = DB::table('media')->where('id', $this->mediaId)->first();
        if ($media === null || $media->status !== 'transcoding') {
            return;
        }
        $rules = config('media.kinds.'.$media->kind);
        $mode = $rules['transcode'] ?? null;
        if ($mode === null) {
            return;
        }

        switch ($transcoder->state($media->id)) {
            case 'absent':
                $raw = $storage->get($media->storage_key, (int) $rules['max_bytes']);
                if ($raw === '' || strlen($raw) > (int) $rules['max_bytes']) {
                    $this->refuse($media, $transcoder, $storage, $notifier);

                    return;
                }
                $transcoder->submit($media->id, $mode, $raw);
                $this->release((int) config('media.transcode.poll_seconds'));

                return;
            case 'pending':
                if ($transcoder->ageSeconds($media->id) > (int) config('media.transcode.timeout_seconds')) {
                    $this->refuse($media, $transcoder, $storage, $notifier);

                    return;
                }
                $this->release((int) config('media.transcode.poll_seconds'));

                return;
            case 'failed':
                $this->refuse($media, $transcoder, $storage, $notifier);

                return;
        }

        $this->finish($media, $mode, $rules, $transcoder, $storage, $notifier);
    }

    /** Résultat prêt : contrôlé (type, taille, durée), stocké sous une nouvelle clé, puis le média passe en revue humaine. */
    private function finish(object $media, string $mode, array $rules, Transcoder $transcoder, MediaStorage $storage, MediaDecisionNotifier $notifier): void
    {
        try {
            $result = $transcoder->collect($media->id);
        } catch (Throwable $e) {
            report($e);
            $this->refuse($media, $transcoder, $storage, $notifier);

            return;
        }

        [$mime, $extension] = self::OUTPUT[$mode];
        $maxMs = ((int) $rules['max_seconds'] + (int) config('media.transcode.duration_tolerance_seconds')) * 1000;
        $size = strlen($result['bytes']);
        if ($result['mime'] !== $mime || $size < 1 || $size > (int) $rules['max_bytes'] || $result['duration_ms'] < 1 || $result['duration_ms'] > $maxMs) {
            $this->refuse($media, $transcoder, $storage, $notifier);

            return;
        }

        $newKey = sprintf('u/%s/%s/%s.%s', $media->user_id, $media->kind, Str::uuid(), $extension);
        $storage->put($newKey, $result['bytes'], $mime);

        $updated = DB::table('media')->where('id', $media->id)->where('status', 'transcoding')->update([
            'storage_key' => $newKey, 'mime_type' => $mime, 'size_bytes' => $size,
            'duration_seconds' => (int) ceil($result['duration_ms'] / 1000), 'status' => 'processing', 'updated_at' => now(),
        ]);

        // Un autre exemplaire de la tâche a déjà statué : le fichier qu'on vient d'écrire est en trop, l'ancien reste celui du média.
        $storage->delete($updated === 1 ? $media->storage_key : $newKey);
        $transcoder->discard($media->id);
    }

    private function refuse(object $media, Transcoder $transcoder, MediaStorage $storage, MediaDecisionNotifier $notifier): void
    {
        $updated = DB::table('media')->where('id', $media->id)->where('status', 'transcoding')->update([
            'status' => 'rejected', 'moderation_label' => 'unreadable', 'updated_at' => now(),
        ]);

        try {
            $storage->delete($media->storage_key);
        } catch (Throwable $e) {
            report($e);
        }
        $transcoder->discard($media->id);

        if ($updated === 1) {
            $notifier->decided($media->id, 'rejected');
        }
    }
}
