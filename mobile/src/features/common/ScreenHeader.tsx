import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme';
import { Text } from '../../ui';
import { BackButton } from './BackButton';

type Props = { title: string; fallbackHref?: string; right?: React.ReactNode; hideBack?: boolean };

/** En-tête d'écran : retour (repli si la pile est vide), titre (rôle header) et action facultative à droite. */
export function ScreenHeader({ title, fallbackHref = '/discover', right, hideBack = false }: Props) {
  const { space } = useTheme();
  return (
    <View style={{ marginBottom: space[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {hideBack ? <View /> : <BackButton fallbackHref={fallbackHref} />}
        {right}
      </View>
      <Text variant="title" header>
        {title}
      </Text>
    </View>
  );
}
