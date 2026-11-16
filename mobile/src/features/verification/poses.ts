import type { TranslationKey } from '../../i18n';

/**
 * Poses demandées par le serveur (backend/app/Services/ProfileVerification.php, POSES) : il renvoie le texte français.
 * Chaque pose connue a sa traduction ; une pose inconnue (nouvelle pose côté serveur) s'affiche telle que reçue.
 */
const POSE_KEYS: Readonly<Record<string, TranslationKey>> = {
  'pouce levé': 'verify.pose.thumbsUp',
  'main ouverte près du visage': 'verify.pose.openHand',
  'deux doigts levés': 'verify.pose.twoFingers',
  'regard à gauche avec le sourire': 'verify.pose.lookLeft',
};

export function poseLabel(t: (key: TranslationKey) => string, pose: string | undefined): string {
  if (!pose) return '';
  const key = POSE_KEYS[pose];
  return key ? t(key) : pose;
}
