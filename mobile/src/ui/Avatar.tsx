import React from 'react';
import { Image, View } from 'react-native';
import { useTheme } from '../theme';
import { Text } from './Text';

export type AvatarProps = {
  uri?: string | null;
  name: string;
  size?: number;
  testID?: string;
};

/** Pastille ronde : photo si disponible, sinon initiale (décorative : le nom est porté par le texte voisin). */
export function Avatar({ uri, name, size = 48, testID }: AvatarProps) {
  const { colors } = useTheme();
  const base = { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.skeleton };
  if (uri) {
    return <Image testID={testID} source={{ uri }} style={base} accessibilityIgnoresInvertColors accessible={false} />;
  }
  return (
    <View testID={testID} accessible={false} style={[base, { alignItems: 'center', justifyContent: 'center' }]}>
      <Text variant="body" tone="textMuted" style={{ fontWeight: '700' }}>
        {name.trim().charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}
