import React from 'react';
import { I18nManager, Pressable, View } from 'react-native';
import { borderWidth, MIN_TARGET, radius, stateOpacity, useTheme } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';
import { useFocusRing } from './hooks/useFocusRing';

/** Hauteur minimale d'une ligne (docs/design/03 : cible de 56 pt). */
const ROW_MIN_HEIGHT = MIN_TARGET + 12;

export type ListRowProps = {
  label: string;
  description?: string;
  value?: string;
  onPress?: () => void;
  tone?: 'default' | 'danger';
  /** Élément à gauche (avatar). */
  leading?: React.ReactNode;
  /** Élément à droite (badge). */
  trailing?: React.ReactNode;
  /** `trailing` sous le texte (action à libellé long : « Fermer la session ») au lieu de la moitié de la ligne. */
  trailingBelow?: boolean;
  accessibilityLabel?: string;
  testID?: string;
};

/** Ligne de liste en carte arrondie (réglages, conversations) : hauteur >= 56, chevron `ChevronRight` si cliquable. */
export function ListRow({
  label,
  description,
  value,
  onPress,
  tone = 'default',
  leading,
  trailing,
  trailingBelow = false,
  accessibilityLabel,
  testID,
}: ListRowProps) {
  const { colors, space } = useTheme();
  const { handlers, ringStyle } = useFocusRing();
  const card = {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    marginBottom: space[2],
    overflow: 'hidden',
  } as const;
  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: ROW_MIN_HEIGHT,
        paddingVertical: space[2],
        paddingHorizontal: space[4],
        gap: space[3],
      }}
    >
      {leading}
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" tone={tone === 'danger' ? 'danger' : 'text'}>
          {label}
        </Text>
        {description ? (
          <Text variant="caption" tone="textMuted">
            {description}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="caption" tone="textMuted">
          {value}
        </Text>
      ) : null}
      {trailingBelow ? null : trailing}
      {onPress ? (
        // Chevron décoratif (Icon masquée de l'arbre d'accessibilité), inversé en lecture de droite à gauche.
        <View style={{ transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }] }}>
          <Icon name="ChevronRight" size="sm" tone="textMuted" testID={testID ? `${testID}-chevron` : undefined} />
        </View>
      ) : null}
    </View>
  );
  const body = trailingBelow && trailing ? (
    <View>
      {content}
      <View style={{ alignSelf: 'flex-start', paddingHorizontal: space[2], paddingBottom: space[2] }}>{trailing}</View>
    </View>
  ) : (
    content
  );
  if (!onPress) {
    // Ligne statique : regroupée (une seule vocalisation) seulement sans `trailing`. Avec un contrôle à droite
    // (Acheter, Débloquer, Fermer la session), un parent `accessible` le masquerait à VoiceOver : on laisse
    // chaque enfant focalisable.
    const grouped = !trailing;
    return (
      <View
        testID={testID}
        accessible={grouped}
        accessibilityLabel={grouped ? accessibilityLabel : undefined}
        style={card}
      >
        {body}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (description ? `${label}. ${description}` : label)}
      onPress={onPress}
      onFocus={handlers.onFocus}
      onBlur={handlers.onBlur}
      style={({ pressed }) => [card, { opacity: pressed ? stateOpacity.pressed : 1 }, ringStyle]}
    >
      {body}
    </Pressable>
  );
}
