import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme';
import { Logo } from '../../ui';
import { BackButton } from '../common/BackButton';

export type AuthHeaderProps = {
  /** Affiche le bouton Retour (défaut oui). Absent sur les écrans sans retour possible (refus d'âge, nouveau mot de passe). */
  back?: boolean;
  /** Destination du retour quand la pile de navigation est vide. */
  fallbackHref?: string;
};

/** Hauteur du logo en pt (symbole + mot-symbole) en tête des écrans publics clairs. */
const AUTH_LOGO_SIZE = 40;

/** En-tête commun des écrans de connexion et d'inscription : retour éventuel, puis logo couleur horizontal. */
export function AuthHeader({ back = true, fallbackHref }: AuthHeaderProps) {
  const { space } = useTheme();
  return (
    <View testID="auth-header">
      {back ? (
        // Le libellé du bouton Retour s'aligne sur la marge de l'écran ; sa zone tactile garde sa taille.
        <View style={{ marginStart: -space[5] }}>
          <BackButton fallbackHref={fallbackHref} />
        </View>
      ) : null}
      <View style={{ alignSelf: 'flex-start' }}>
        <Logo layout="horizontal" size={AUTH_LOGO_SIZE} testID="auth-logo" />
      </View>
    </View>
  );
}
