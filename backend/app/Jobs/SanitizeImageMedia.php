<?php

namespace App\Jobs;

use App\Services\Media\MediaDecisionNotifier;
use App\Services\MediaSanitizer;
use App\Services\Storage\MediaStorage;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

/**
 * Ré-encode une image hors de la requête (MEDIA_ASYNC_IMAGES), entre la fin du dépôt (`transcoding`) et la revue humaine
 * (`processing`) : le processus web ne décode plus d'image. Mêmes contrôles que le traitement dans la requête : lecture bornée,
 * signature réelle, ré-encodage sans métadonnées vers une NOUVELLE clé, ancienne clé supprimée.
 *
 * Le fichier déposé n'est ni servi ni montré à un modérateur. Un fichier refusé par le nettoyeur est rejeté (« unreadable ») ;
 * une panne passagère (stockage) laisse la tâche réessayer, et le média est rejeté quand les essais sont épuisés, pour que la
 * personne puisse recommencer au lieu d'attendre sans fin.
 */
class SanitizeImageMedia implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    /** En dessous du `--timeout=60` du worker et du `retry_after` de la file (90 s). */
    public int $timeout = 50;

    public int $uniqueFor = 600;

    public function __construct(public string $mediaId)
    {
        $this->onQueue('media');
    }

    /** @return list<int> */
    public function backoff(): array
    {
        return [10, 60];
    }

    public function uniqueId(): string
    {
        return $this->mediaId;
    }

    public function handle(MediaStorage $storage, MediaSanitizer $sanitizer, MediaDecisionNotifier $notifier): void
    {
        $media = $this->waiting();
        if ($media === null) {
            return;
        }
        $maxBytes = (int) config('media.kinds.'.$media->kind.'.max_bytes');

        // Lecture bornée : l'objet a pu être remplacé après le contrôle de la fin de dépôt (revue N-14).
        $raw = $storage->get($media->storage_key, $maxBytes);
        $clean = $raw === '' || strlen($raw) > $maxBytes ? null : $sanitizer->clean($raw, $media->mime_type);
        if ($clean === null) {
            $this->refuse($media, $storage, $notifier);

            return;
        }

        $newKey = sprintf('u/%s/%s/%s.%s', $media->user_id, $media->kind, Str::uuid(), $clean['ext']);
        $storage->put($newKey, $clean['bytes'], $clean['mime']);

        $status = config('media.auto_approve') ? 'approved' : 'processing';
        $updated = DB::table('media')->where('id', $media->id)->where('status', 'transcoding')->update([
            'storage_key' => $newKey, 'mime_type' => $clean['mime'], 'size_bytes' => strlen($clean['bytes']),
            'status' => $status, 'updated_at' => now(),
        ]);

        // Un autre exemplaire de la tâche a déjà statué : le fichier qu'on vient d'écrire est en trop.
        $storage->delete($updated === 1 ? $media->storage_key : $newKey);

        if ($updated === 1 && $status === 'approved') {
            $notifier->decided($media->id, 'approved');
        }
    }

    public function failed(?Throwable $exception): void
    {
        $media = $this->waiting();
        if ($media !== null) {
            $this->refuse($media, app(MediaStorage::class), app(MediaDecisionNotifier::class));
        }
    }

    private function waiting(): ?object
    {
        return DB::table('media')->where('id', $this->mediaId)->where('status', 'transcoding')->first();
    }

    private function refuse(object $media, MediaStorage $storage, MediaDecisionNotifier $notifier): void
    {
        $updated = DB::table('media')->where('id', $media->id)->where('status', 'transcoding')->update([
            'status' => 'rejected', 'moderation_label' => 'unreadable', 'updated_at' => now(),
        ]);

        try {
            $storage->delete($media->storage_key);
        } catch (Throwable $e) {
            report($e);
        }

        if ($updated === 1) {
            $notifier->decided($media->id, 'rejected');
        }
    }
}
