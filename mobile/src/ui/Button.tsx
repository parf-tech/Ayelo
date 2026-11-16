import React from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { borderWidth, MIN_TARGET, stateOpacity, useTheme } from '../theme';
import { Text } from './Text';
import { useFocusRing } from './hooks/useFocusRing';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

/** `default` : surface du thème. `onBrand` : posé sur le fond prune pleine page (accueil) ; secondary et ghost passent en clair. */
export type ButtonTone = 'default' | 'onBrand';

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  tone?: ButtonTone;
  loading?: boolean;
  disabled?: boolean;
  /** Libellé lu par les lecteurs d'écran si différent du texte affiché. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Texte lu pendant le chargement (par défaut : le libellé). */
  loadingLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  /** Référence du bouton (React 19 : `ref` est une prop) : sert à y ramener le focus du lecteur d'écran. */
  ref?: React.Ref<React.ComponentRef<typeof Pressable>>;
};

/**
 * Bouton : primary, secondary, ghost, danger ; états default, pressed, disabled, loading. Cible >= 44 pt.
 * Le libellé n'est jamais tronqué : il passe à la ligne quand la police est agrandie (200 %) ou l'écran étroit (320 pt).
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  tone = 'default',
  loading = false,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  loadingLabel,
  testID,
  style,
  ref,
}: ButtonProps) {
  const { colors, radius, space } = useTheme();
  const inactive = disabled || loading;
  const { handlers, ringStyle } = useFocusRing(tone === 'onBrand' ? colors.onBrand : undefined);
  const palette = paletteFor(variant, colors, tone);

  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={loading && loadingLabel ? loadingLabel : (accessibilityLabel ?? label)}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      testID={testID}
      onFocus={handlers.onFocus}
      onBlur={handlers.onBlur}
      style={({ pressed }) => {
        const backgroundColor = disabled ? (variant === 'ghost' ? 'transparent' : colors.disabledBg) : palette.bg;
        const borderColor = disabled ? colors.disabledBg : palette.border;
        const base: ViewStyle = {
          minHeight: MIN_TARGET + 4,
          minWidth: MIN_TARGET,
          paddingHorizontal: space[5],
          paddingVertical: space[3],
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: variant === 'secondary' ? borderWidth.strong : 0,
          backgroundColor,
          borderColor,
          opacity: pressed && !inactive ? stateOpacity.pressed : 1,
        };
        return [base, ringStyle, style];
      }}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator
            testID={testID ? `${testID}-spinner` : 'button-spinner'}
            color={palette.fg}
            style={{ marginRight: space[2] }}
          />
        ) : null}
        <Text
          variant="bodyStrong"
          style={{
            color: disabled ? colors.disabledText : palette.fg,
            flexShrink: 1,
            textAlign: 'center',
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

function paletteFor(variant: ButtonVariant, colors: ReturnType<typeof useTheme>['colors'], tone: ButtonTone) {
  const onBrand = tone === 'onBrand';
  switch (variant) {
    case 'secondary':
      return { bg: 'transparent', fg: onBrand ? colors.onBrand : colors.primary, border: onBrand ? colors.onBrand : colors.primary };
    case 'ghost':
      return { bg: 'transparent', fg: onBrand ? colors.onBrand : colors.primary, border: 'transparent' };
    case 'danger':
      return { bg: colors.danger, fg: colors.onPrimary, border: colors.danger };
    case 'primary':
    default:
      return { bg: colors.primary, fg: colors.onPrimary, border: colors.primary };
  }
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexShrink: 1, maxWidth: '100%' },
});
