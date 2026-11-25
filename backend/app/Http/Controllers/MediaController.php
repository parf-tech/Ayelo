<?php

namespace App\Http\Controllers;

use App\Jobs\TranscodeChatMedia;
use App\Models\Media;
use App\Services\MediaSanitizer;
use App\Services\Storage\MediaStorage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

class MediaController extends Controller
{
    private const EXT = [
        'image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp',
        'video/mp4' => 'mp4', 'video/quicktime' => 'mov', 'audio/mp4' => 'm4a', 'audio/x-m4a' => 'm4a', 'audio/aac' => 'aac', 'audio/mpeg' => 'mp3',
    ];

    public function uploadUrl(Request $request, MediaStorage $storage): JsonResponse
    {
        // Tous les types connus figurent dans le contrat ; un type fermé (`enabled` faux : notes vocales et vidéos tant que le
        // conteneur de traitement n'est pas déployé) est refusé plus bas, comme une valeur invalide.
        $kinds = array_keys(config('media.kinds'));
        $data = $request->validate([
            'kind' => ['required', Rule::in($kinds)],
            'mime_type' => ['required', 'string', 'max:100'],
            'size_bytes' => ['required', 'integer', 'min:1'],
            'duration_seconds' => ['nullable', 'integer', 'min:1', 'max:3600'],
        ]);

        $rules = config('media.kinds.'.$data['kind']);
        if (! ($rules['enabled'] ?? true)) {
            throw ValidationException::withMessages(['kind' => ["Ce type de fichier n'est pas disponible."]]);
        }
        if (! in_array($data['mime_type'], $rules['mimes'], true)) {
            throw ValidationException::withMessages(['mime_type' => ['Type de fichier non autorisé.']]);
        }
        if ($data['size_bytes'] > $rules['max_bytes']) {
            throw ValidationException::withMessages(['size_bytes' => ['Fichier trop volumineux.']]);
        }
        if (isset($rules['max_seconds']) && ($data['duration_seconds'] ?? 0) > $rules['max_seconds']) {
            throw ValidationException::withMessages(['duration_seconds' => ['Durée maximale dépassée.']]);
        }

        $user = $request->user();
        $position = 0;

        // Quota par type (revue F-22) : le plafond de 20 dépôts par heure ne bornait pas le stockage par compte.
        if (isset($rules['max_open']) && DB::table('media')->where('user_id', $user->id)->where('kind', $data['kind'])
            ->whereIn('status', ['pending_upload', 'transcoding', 'processing'])->count() >= (int) $rules['max_open']) {
            throw ValidationException::withMessages(['kind' => ['Trop de fichiers en attente pour ce type.']]);
        }
        if (isset($rules['max_per_day']) && DB::table('media')->where('user_id', $user->id)->where('kind', $data['kind'])
            ->where('created_at', '>', now()->subDay())->count() >= (int) $rules['max_per_day']) {
            throw ValidationException::withMessages(['kind' => ['Quota quotidien atteint pour ce type.']]);
        }

        if ($data['kind'] === 'profile_photo') {
            $used = DB::table('media')->where('user_id', $user->id)->where('kind', 'profile_photo')
                ->whereIn('status', ['pending_upload', 'processing', 'approved'])->pluck('position')->all();
            if (count($used) >= (int) config('media.max_profile_photos')) {
                throw ValidationException::withMessages(['kind' => ['Nombre maximal de photos atteint.']]);
            }
            while (in_array($position, $used, true)) {
                $position++;
            }
        }

        $id = (string) Str::uuid();
        $key = sprintf('u/%s/%s/%s.%s', $user->id, $data['kind'], $id, self::EXT[$data['mime_type']]);

        $media = Media::create([
            'id' => $id,
            'user_id' => $user->id,
            'kind' => $data['kind'],
            'status' => 'pending_upload',
            'storage_key' => $key,
            'mime_type' => $data['mime_type'],
            'size_bytes' => $data['size_bytes'],
            'duration_seconds' => $data['duration_seconds'] ?? null,
            'position' => $position,
        ]);

        $upload = $storage->presignedUpload($key, $data['mime_type'], $data['size_bytes'], (int) config('media.upload_ttl_minutes'));

        return response()->json(['media_id' => $media->id, 'upload' => $upload], 201);
    }

    public function complete(Request $request, string $id, MediaStorage $storage, MediaSanitizer $sanitizer): JsonResponse
    {
        $media = $this->ownedMedia($request, $id);

        if ($media->status !== 'pending_upload') {
            return response()->json(['error' => ['code' => 'already_completed', 'message' => 'Média déjà traité.']], 409);
        }

        // On ne fait pas confiance à la déclaration du client : on relit l'objet réellement déposé.
        $head = $storage->head($media->storage_key);
        $rules = config('media.kinds.'.$media->kind);

        if ($head === null) {
            return response()->json(['error' => ['code' => 'upload_missing', 'message' => 'Fichier introuvable.']], 422);
        }

        if ($head['size'] > $rules['max_bytes'] || $head['size'] !== (int) $media->size_bytes || $head['mime'] !== $media->mime_type) {
            $storage->delete($media->storage_key);
            $media->delete();

            return response()->json(['error' => ['code' => 'upload_rejected', 'message' => 'Fichier refusé.']], 422);
        }

        // Notes vocales et vidéos : jamais lues ici ni servies telles que déposées. Le conteneur de traitement (ffmpeg, sans réseau)
        // les réencode sans métadonnées et mesure durée et taille ; la revue humaine ne les voit qu'ensuite (TranscodeChatMedia).
        if (($rules['transcode'] ?? null) !== null) {
            $media->status = 'transcoding';
            $media->save();
            TranscodeChatMedia::dispatch($media->id);

            // L'état « transcoding » est interne : le client voit « processing » (en vérification).
            return response()->json(['media_id' => $media->id, 'status' => 'processing']);
        }

        // Le type et la taille déclarés ne suffisent pas (la présignature ne les lie pas) : on relit les octets,
        // on vérifie la signature réelle, puis on ré-encode l'image sans métadonnées (EXIF/GPS) vers une NOUVELLE clé.
        // L'ancienne clé est supprimée : l'URL de dépôt encore valide ne peut plus remplacer un média approuvé.
        // Lecture bornée : l'objet a pu être remplacé entre le HEAD et la lecture (revue N-14).
        $raw = $storage->get($media->storage_key, (int) $rules['max_bytes']);
        $clean = strlen($raw) > (int) $rules['max_bytes'] ? null : $sanitizer->clean($raw, $media->mime_type);
        if ($clean === null) {
            $storage->delete($media->storage_key);
            $media->delete();

            return response()->json(['error' => ['code' => 'upload_rejected', 'message' => 'Fichier refusé.']], 422);
        }

        $newKey = sprintf('u/%s/%s/%s.%s', $media->user_id, $media->kind, Str::uuid(), $clean['ext']);
        $storage->put($newKey, $clean['bytes'], $clean['mime']);
        $storage->delete($media->storage_key);
        $media->storage_key = $newKey;
        $media->size_bytes = strlen($clean['bytes']);
        $media->mime_type = $clean['mime'];

        // Aucun média n'est public avant approbation (FR-B-8) : file de modération humaine tant
        // qu'aucun prestataire automatique n'est branché.
        $media->status = config('media.auto_approve') ? 'approved' : 'processing';
        $media->save();

        /**
         * `processing` : en file de revue humaine ; `approved` : approbation automatique (développement local).
         *
         * @body array{media_id: string, status: 'processing'|'approved'}
         */
        return response()->json(['media_id' => $media->id, 'status' => $media->status]);
    }

    public function destroy(Request $request, string $id, MediaStorage $storage): Response
    {
        $media = $this->ownedMedia($request, $id);

        // Revue pentest P-04 : la suppression d'un média ne doit détruire ni une preuve ni une pièce de revue. Les clés étrangères
        // supprimaient en cascade la demande de vérification (selfie) ou mettaient `messages.media_id` à NULL (preuve de signalement).
        // On refuse (409) tant que le média est retenu ; le fichier est purgé plus tard par la conservation et le balayage d'orphelins.
        if ($this->isRetained($media)) {
            return response()->json(['error' => ['code' => 'media_retained', 'message' => 'Ce fichier est conservé et ne peut pas être supprimé pour le moment.']], 409);
        }

        $storage->delete($media->storage_key);
        $media->delete();

        return response()->noContent();
    }

    /**
     * Média référencé par une demande de vérification, un message (image, vidéo, vocal ; même supprimé côté expéditeur, la ligne
     * est conservée comme preuve) ou une story visée par un signalement non clos. Un média non référencé reste supprimable.
     */
    private function isRetained(Media $media): bool
    {
        return DB::table('verification_requests')->where('selfie_media_id', $media->id)->exists()
            || DB::table('messages')->where('media_id', $media->id)->exists()
            || DB::table('stories')->join('reports', function ($join) {
                $join->on('reports.context_id', '=', 'stories.id')->where('reports.context_type', 'story');
            })->where('stories.media_id', $media->id)->whereIn('reports.status', ['open', 'reviewed'])->exists();
    }

    /**
     * Média du demandeur uniquement. Inexistant et appartenant à autrui donnent le même 404 : l'ancien « findOrFail puis
     * authorize » répondait 404 ou 403 selon l'existence du média (oracle, revue F-26).
     */
    private function ownedMedia(Request $request, string $id): Media
    {
        $media = Media::where('id', $id)->where('user_id', $request->user()->id)->first();
        abort_if($media === null, 404);
        Gate::forUser($request->user())->authorize('manage', $media);

        return $media;
    }

    public function reorder(Request $request): JsonResponse
    {
        $data = $request->validate(['ids' => ['required', 'array', 'min:1', 'max:6'], 'ids.*' => ['uuid', 'distinct']]);
        $userId = $request->user()->id;

        $current = DB::table('media')->where('user_id', $userId)->where('kind', 'profile_photo')
            ->whereIn('status', ['pending_upload', 'processing', 'approved'])->pluck('id')->all();

        if (count($current) !== count($data['ids']) || array_diff($current, $data['ids']) !== []) {
            throw ValidationException::withMessages(['ids' => ['La liste doit contenir exactement vos photos.']]);
        }

        // L'index unique (user_id, position) interdit l'échange direct : on décale puis on place.
        DB::transaction(function () use ($data, $userId) {
            DB::table('media')->where('user_id', $userId)->where('kind', 'profile_photo')->whereIn('id', $data['ids'])
                ->update(['position' => DB::raw('position + 6')]);
            foreach ($data['ids'] as $position => $id) {
                DB::table('media')->where('id', $id)->update(['position' => $position, 'updated_at' => now()]);
            }
        });

        return response()->json(['ids' => $data['ids']]);
    }
}
