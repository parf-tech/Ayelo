import { ApiError } from '../api/errors';
import type { Api } from '../api/endpoints';
import type { MediaCompleteResponse, UploadKind } from '../api/types';
import type { PickedImage } from './picker';

export const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;

const EXTENSIONS: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

/** Type MIME accepté par le serveur, déduit du sélecteur ou de l'extension ; null si le format n'est pas pris en charge. */
export function resolveImageMime(image: Pick<PickedImage, 'uri' | 'mimeType'>): string | null {
  const declared = image.mimeType?.toLowerCase() ?? null;
  if (declared && (IMAGE_MIMES as readonly string[]).includes(declared)) return declared;
  if (declared === 'image/jpg') return 'image/jpeg';
  if (declared) return null;
  const ext = image.uri.split('?')[0]?.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSIONS[ext] ?? null;
}

export type UploadOptions = {
  kind: UploadKind;
  image: PickedImage;
  /** Remplaçable en test. */
  fetchImpl?: typeof fetch;
};

/**
 * Envoi d'un média en trois temps : URL présignée (POST /media/upload-url), dépôt du fichier par PUT
 * sur cette URL (sans jeton d'authentification : c'est le stockage objet), puis POST /media/{id}/complete.
 * Si le dépôt échoue, la réservation côté serveur est supprimée au mieux (libère l'emplacement).
 */
export async function uploadMedia(api: Api, { kind, image, fetchImpl }: UploadOptions): Promise<MediaCompleteResponse> {
  const doFetch = fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const mime = resolveImageMime(image);
  if (!mime) throw new ApiError({ status: 0, code: 'unsupported_format', message: 'Unsupported image format' });

  let blob: Blob;
  try {
    blob = await (await doFetch(image.uri)).blob();
  } catch {
    throw new ApiError({ status: 0, code: 'upload_failed', message: 'Cannot read the selected file' });
  }

  const presigned = await api.profile.createUploadUrl({ kind, mime_type: mime, size_bytes: blob.size });

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
