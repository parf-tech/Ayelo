import { ApiError } from '../api/errors';
import type { Api } from '../api/endpoints';
import type { MediaCompleteResponse, UploadKind } from '../api/types';
import type { PickedImage } from './picker';

export const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;
/** Notes vocales : m4a (AAC) d'abord, ce que produisent iOS et Android. Mêmes types que le serveur (config/media.php). */
export const AUDIO_MIMES = ['audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/mpeg'] as const;
/** Vidéos : mp4 (Android) et mov (iPhone). */
export const VIDEO_MIMES = ['video/mp4', 'video/quicktime'] as const;

const EXTENSIONS: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
};

/**
 * Type MIME accepté par le serveur parmi `allowed`, déduit du sélecteur ou de l'extension ; null si le format n'est pas pris en
 * charge. Un type déclaré hors de la liste est refusé même si l'extension ressemble à un format accepté.
 */
export function resolveMediaMime(file: Pick<PickedImage, 'uri' | 'mimeType'>, allowed: readonly string[]): string | null {
  const declared = file.mimeType?.toLowerCase() ?? null;
  if (declared && allowed.includes(declared)) return declared;
  if (declared === 'image/jpg' && allowed.includes('image/jpeg')) return 'image/jpeg';
  if (declared) return null;
  const ext = file.uri.split('?')[0]?.split('.').pop()?.toLowerCase() ?? '';
  const guessed = EXTENSIONS[ext];
  return guessed && allowed.includes(guessed) ? guessed : null;
}

/** Type MIME d'une image acceptée par le serveur ; null si le format n'est pas pris en charge. */
export function resolveImageMime(image: Pick<PickedImage, 'uri' | 'mimeType'>): string | null {
  return resolveMediaMime(image, IMAGE_MIMES);
}

/** Types acceptés selon le type de média déposé. */
function allowedMimes(kind: UploadKind): readonly string[] {
  if (kind === 'message_voice') return AUDIO_MIMES;
  if (kind === 'message_video') return VIDEO_MIMES;
  return IMAGE_MIMES;
}

export type UploadOptions = {
  kind: UploadKind;
  /** Le fichier choisi ou enregistré (image, note vocale, vidéo : le nom du champ date des photos). */
  image: PickedImage;
  /** Durée en secondes d'une note vocale ou d'une vidéo, déclarée au serveur (qui la mesure lui-même après traitement). */
  durationSeconds?: number;
  /** Remplaçable en test. */
  fetchImpl?: typeof fetch;
};

/**
 * Envoi d'un média en trois temps : URL présignée (POST /media/upload-url), dépôt du fichier par PUT
 * sur cette URL (sans jeton d'authentification : c'est le stockage objet), puis POST /media/{id}/complete.
 * Si le dépôt échoue, la réservation côté serveur est supprimée au mieux (libère l'emplacement).
 */
export async function uploadMedia(api: Api, { kind, image, durationSeconds, fetchImpl }: UploadOptions): Promise<MediaCompleteResponse> {
  const doFetch = fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const mime = resolveMediaMime(image, allowedMimes(kind));
  if (!mime) throw new ApiError({ status: 0, code: 'unsupported_format', message: 'Unsupported image format' });

  let blob: Blob;
  try {
    blob = await (await doFetch(image.uri)).blob();
  } catch {
    throw new ApiError({ status: 0, code: 'upload_failed', message: 'Cannot read the selected file' });
  }

  const presigned = await api.profile.createUploadUrl({
    kind,
    mime_type: mime,
    size_bytes: blob.size,
    ...(durationSeconds !== undefined ? { duration_seconds: durationSeconds } : null),
  });

  let put: Response;
  try {
    put = await doFetch(presigned.upload.url, { method: 'PUT', headers: presigned.upload.headers, body: blob });
  } catch {
    await api.profile.deleteMedia(presigned.media_id).catch(() => undefined);
    throw new ApiError({ status: 0, code: 'upload_failed', message: 'Upload failed' });
  }
  if (!put.ok) {
    await api.profile.deleteMedia(presigned.media_id).catch(() => undefined);
    throw new ApiError({ status: put.status, code: 'upload_failed', message: `Upload failed (HTTP ${put.status})` });
  }

  return api.profile.completeUpload(presigned.media_id);
}
