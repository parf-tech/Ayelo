import React from 'react';
import { View } from 'react-native';
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
  return (
    <View testID="auth-header">
      {back ? <BackButton fallbackHref={fallbackHref} /> : null}
      <View style={{ alignSelf: 'flex-start' }}>
        <Logo layout="horizontal" size={AUTH_LOGO_SIZE} testID="auth-logo" />
      </View>
    </View>
  );
}
