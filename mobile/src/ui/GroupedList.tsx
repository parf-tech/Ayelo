import React from 'react';
import { I18nManager, Pressable, View } from 'react-native';
import { borderWidth, focus, MIN_TARGET, stateOpacity, useTheme } from '../theme';
import { useCompactLayout, useFocusRing } from './hooks';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

/**
 * Groupe de lignes sur une carte (réglages, profil) : fond `surface`, coins arrondis, un filet fin entre deux lignes seulement.
 * Présentation seule : chaque ligne garde son identifiant de test, son rôle et son libellé d'accessibilité.
 */
export function RowGroup({ children, testID }: { children: React.ReactNode; testID?: string }) {
  const { colors, radius } = useTheme();
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <View
      testID={testID}
      style={{ backgroundColor: colors.surface, borderRadius: radius.md, overflow: 'hidden' }}
    >
      {rows.map((row, index) => (
        <View key={index} style={index > 0 ? { borderTopWidth: borderWidth.hairline, borderTopColor: colors.border } : undefined}>
          {row}
        </View>
      ))}
    </View>
  );
}

export type NavRowProps = {
  label: string;
  onPress: () => void;
  /** Pictogramme à gauche (décoratif : le libellé porte le sens). */
  icon?: IconName;
  description?: string;
  /** Valeur courte à droite (ex. état). */
  value?: string;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  /** Élément supplémentaire à droite, avant le chevron (badge d'état). */
  trailing?: React.ReactNode;
  accessibilityLabel?: string;
  testID?: string;
};

/** Ligne cliquable d'un `RowGroup` : icône, libellé, chevron. Cible >= 44 pt, non désactivée par la seule couleur. */
export function NavRow({ label, onPress, icon, description, value, tone = 'default', disabled = false, trailing, accessibilityLabel, testID }: NavRowProps) {
  const { space } = useTheme();
  const { focused, handlers, ringStyle } = useFocusRing();
  // Texte agrandi : la valeur (ex. langue) passe sous le libellé au lieu de lui laisser quelques points.
  const { isLarge } = useCompactLayout();
  const danger = tone === 'danger';
  const iconTone = disabled ? 'disabledText' : danger ? 'danger' : 'primary';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (description ? `${label}. ${description}` : label)}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onFocus={handlers.onFocus}
      onBlur={handlers.onBlur}
      // Le groupe rogne ses coins (overflow hidden) : l'anneau est tracé vers l'intérieur pour rester visible.
      style={({ pressed }) => [{ opacity: pressed ? stateOpacity.pressed : 1 }, ringStyle, focused ? { outlineOffset: -focus.width } : null]}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: MIN_TARGET + 12,
          paddingVertical: space[2],
          paddingHorizontal: space[4],
          gap: space[3],
        }}
      >
        {icon ? <Icon name={icon} tone={iconTone} /> : null}
        <View style={{ flex: 1 }}>
          <Text variant="bodyMedium" tone={disabled ? 'textMuted' : danger ? 'danger' : 'text'}>
            {label}
          </Text>
          {description ? (
            <Text variant="caption" tone="textMuted">
              {description}
            </Text>
          ) : null}
          {value && isLarge ? (
            <Text variant="caption" tone="textMuted">
              {value}
            </Text>
          ) : null}
        </View>
        {value && !isLarge ? (
          <Text variant="caption" tone="textMuted">
            {value}
          </Text>
        ) : null}
        {trailing}
        {/* Chevron décoratif, inversé en lecture de droite à gauche (comme ListRow). */}
        <View style={{ transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }] }}>
          <Icon name="ChevronRight" size="sm" tone="textMuted" />
        </View>
      </View>
    </Pressable>
  );
}
