import React, { useState } from 'react';
import { Image, View } from 'react-native';
import { borderWidth, fontWeight, space, useTheme } from '../theme';
import { Text } from './Text';

/** `true` = anneau de story. `verified` = anneau couleur du jeton `verified`. */
export type AvatarRing = boolean | 'story' | 'verified';

export type AvatarProps = {
  uri?: string | null;
  name: string;
  size?: number;
  /**
   * Anneau autour de l'avatar. Dessiné À L'INTÉRIEUR de `size` (la photo rétrécit de 2 × (trait + écart)) :
   * la taille occupée dans la mise en page ne change pas. Absent ou `false` : rendu inchangé.
   */
  ring?: AvatarRing;
  testID?: string;
};

/** Épaisseur du trait et écart entre l'anneau et la photo (jetons borderWidth.strong et space[1]). */
const RING_WIDTH = borderWidth.strong;
const RING_GAP = space[1];
/** Rapport entre la taille de l'initiale et celle du disque. */
const INITIAL_RATIO = 0.4;

/** Pastille ronde : photo si disponible, sinon initiale (décorative : le nom est porté par le texte voisin). */
export function Avatar({ uri, name, size = 48, ring, testID }: AvatarProps) {
  const { colors, type } = useTheme();
  // Photo illisible (adresse cassée, réseau) : on retombe sur l'initiale au lieu d'un disque vide.
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const failed = uri != null && uri === failedUri;
  const ringKind = ring === true ? 'story' : ring === 'story' || ring === 'verified' ? ring : null;
  const inset = ringKind ? RING_WIDTH + RING_GAP : 0;
  const inner = size - 2 * inset;
  const base = { width: inner, height: inner, borderRadius: inner / 2, backgroundColor: colors.skeleton };
  // Taille de l'initiale proportionnelle au disque, plafonnée au titre le plus grand de l'échelle typographique.
  const initialSize = Math.min(Math.max(Math.round(inner * INITIAL_RATIO), type.body.size), type.title.size);
  const body = uri && !failed ? (
    <Image
      testID={testID}
      source={{ uri }}
      style={base}
      accessibilityIgnoresInvertColors
      accessible={false}
      onError={() => setFailedUri(uri ?? null)}
    />
  ) : (
    <View testID={testID} accessible={false} style={[base, { alignItems: 'center', justifyContent: 'center' }]}>
      <Text variant="body" tone="textMuted" style={{ fontWeight: fontWeight.bold, fontSize: initialSize, lineHeight: Math.round(initialSize * 1.25) }}>
        {name.trim().charAt(0).toUpperCase()}
      </Text>
    </View>
  );
  if (!ringKind) return body;
  return (
    <View
      testID={testID ? `${testID}-ring` : undefined}
      accessible={false}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: RING_WIDTH,
        borderColor: ringKind === 'verified' ? colors.verified : colors.primary,
        padding: RING_GAP,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {body}
    </View>
  );
}
