import type { Intent } from '../../api/types';
import type { IconName } from '../../ui/icons';

/**
 * Pictogramme de chaque intention, pris dans le registre existant (ui/icons.ts).
 * Icônes idéales absentes du registre (à demander au propriétaire du registre) :
 * `Gem` ou `Rings` (mariage), `Infinity` (relation durable), `Users` (amitié), `Compass` (on verra bien).
 */
export const INTENT_ICONS: Record<Intent, IconName> = {
  marriage: 'Heart',
  long_lasting_love: 'Clock',
  flirt: 'Sparkles',
  friendship: 'User',
  lets_find_out: 'Search',
};
