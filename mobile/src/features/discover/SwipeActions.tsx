import React from 'react';
import { View } from 'react-native';
import type { SwipeAction } from '../../api/types';
import { useI18n } from '../../i18n';
import { MIN_TARGET, useTheme } from '../../theme';
import { IconButton } from '../../ui';

/** Diamètre des boutons ronds Passer et Coup de cœur, et du bouton J'aime (plus grand, au centre de gravité du pouce). */
export const ACTION_SIZE = MIN_TARGET + 12;
export const ACTION_SIZE_PRIMARY = MIN_TARGET + 24;

type Props = {
  /** Préfixe des identifiants de test : `swipe` (pile) ou `detail` (fiche) -> `swipe-dislike`, `swipe-super`, `swipe-like`. */
  idPrefix: 'swipe' | 'detail';
  onAction: (action: SwipeAction) => void;
  /** Aucune carte ou aucun profil à noter : tous les boutons sont inertes. */
  disabled?: boolean;
  /** Action en cours d'envoi : son bouton affiche l'attente, les deux autres sont inertes. */
  pending?: SwipeAction | null;
};

/** Les trois boutons ronds d'une décision (passer, coup de cœur, j'aime), communs à la pile et à la fiche d'un profil. */
export function SwipeActions({ idPrefix, onAction, disabled = false, pending = null }: Props) {
  const { t } = useI18n();
  const { space, radius } = useTheme();
  // Le bouton en attente montre son indicateur (pas grisé) ; les deux autres sont inertes tant que l'envoi n'est pas fini.
  const inertFor = (action: SwipeAction) => disabled || (pending !== null && pending !== action);
  const round = (size: number) => ({ width: size, height: size, borderRadius: radius.pill });
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space[5] }}>
      <IconButton
        testID={`${idPrefix}-dislike`}
        icon="X"
        variant="tonal"
        size="lg"
        accessibilityLabel={t('discover.dislike')}
        disabled={inertFor('dislike')}
        loading={pending === 'dislike'}
        onPress={() => onAction('dislike')}
        style={round(ACTION_SIZE)}
      />
      <IconButton
        testID={`${idPrefix}-super`}
        icon="Star"
        variant="tonal"
        size="lg"
        accessibilityLabel={t('discover.superLike')}
        disabled={inertFor('super_like')}
        loading={pending === 'super_like'}
        onPress={() => onAction('super_like')}
        style={round(ACTION_SIZE)}
      />
      <IconButton
        testID={`${idPrefix}-like`}
        icon="Heart"
        variant="filled"
        size="lg"
        accessibilityLabel={t('discover.like')}
        disabled={inertFor('like')}
        loading={pending === 'like'}
        onPress={() => onAction('like')}
        style={round(ACTION_SIZE_PRIMARY)}
      />
    </View>
  );
}
