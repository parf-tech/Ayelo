import { isApiError } from '../../api/errors';
import type { Api } from '../../api/endpoints';
import type { ProfileMedia, PublicProfile, SwipeAction } from '../../api/types';

export type SwipeOutcome =
  | { kind: 'ok' }
  | { kind: 'matched'; matchId: string | null; conversationId: string | null }
  | { kind: 'premium' }
  | { kind: 'quota' }
  | { kind: 'error'; error: unknown };

/** POST /swipes avec classement des réponses : 402 premium_required, 429 quota_reached, match réciproque. */
export async function performSwipe(api: Api, targetId: string, action: SwipeAction): Promise<SwipeOutcome> {
  try {
    const result = await api.discovery.swipe(targetId, action);
    if (result.matched) {
      return { kind: 'matched', matchId: result.match_id ?? null, conversationId: result.conversation_id ?? null };
    }
    return { kind: 'ok' };
  } catch (error) {
    if (isApiError(error)) {
      if (error.status === 402 || error.code === 'premium_required') return { kind: 'premium' };
      if (error.code === 'quota_reached') return { kind: 'quota' };
    }
    return { kind: 'error', error };
  }
}

export const SWIPE_DISTANCE = 110;

/** Décision d'un geste : droite = like, gauche = dislike, haut = coup de cœur ; sinon la carte revient. */
export function decideSwipe(dx: number, dy: number): SwipeAction | null {
  if (dy < -SWIPE_DISTANCE * 1.3 && Math.abs(dy) > Math.abs(dx)) return 'super_like';
  if (dx > SWIPE_DISTANCE) return 'like';
  if (dx < -SWIPE_DISTANCE) return 'dislike';
  return null;
}

/** Photos lisibles d'un profil, dans l'ordre (les médias sans URL, en attente, sont ignorés). */
export function readablePhotos(profile: Pick<PublicProfile, 'media'>): ProfileMedia[] {
  return profile.media.filter((m) => m.kind === 'profile_photo' && m.url).sort((a, b) => a.position - b.position);
}

export function primaryPhotoUrl(profile: Pick<PublicProfile, 'media'>): string | null {
  return readablePhotos(profile)[0]?.url ?? null;
}
