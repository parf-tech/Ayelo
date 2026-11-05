import React from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { MIN_TARGET, useTheme } from '../theme';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  /** Libellé lu par les lecteurs d'écran si différent du texte affiché. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Texte lu pendant le chargement (par défaut : le libellé). */
  loadingLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

/** Bouton : primary, secondary, ghost, danger ; états default, pressed, disabled, loading. Cible >= 44 pt. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  loadingLabel,
  testID,
  style,
}: ButtonProps) {
  const { colors, radius, space } = useTheme();
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={loading && loadingLabel ? loadingLabel : (accessibilityLabel ?? label)}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      testID={testID}
      hitSlop={4}
      style={({ pressed }) => {
        const palette = paletteFor(variant, colors);
        const base: ViewStyle = {
          minHeight: MIN_TARGET + 4,
          minWidth: MIN_TARGET,
          paddingHorizontal: space[5],
          paddingVertical: space[3],
          borderRadius: radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: variant === 'secondary' ? 1.5 : 0,
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: pressed && !inactive ? 0.78 : 1,
        };
        if (disabled) {
          base.backgroundColor = variant === 'ghost' ? 'transparent' : colors.disabledBg;
          base.borderColor = colors.disabledBg;
        }
        return [base, style];
      }}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator
            testID={testID ? `${testID}-spinner` : 'button-spinner'}
            color={paletteFor(variant, colors).fg}
            style={{ marginRight: space[2] }}
          />
        ) : null}
        <Text
          variant="body"
          style={{
            color: disabled ? colors.disabledText : paletteFor(variant, colors).fg,
            fontWeight: '600',
          }}
          numberOfLines={2}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

function paletteFor(variant: ButtonVariant, colors: ReturnType<typeof useTheme>['colors']) {
  switch (variant) {
    case 'secondary':
      return { bg: 'transparent', fg: colors.primary, border: colors.primary };
    case 'ghost':
      return { bg: 'transparent', fg: colors.primary, border: 'transparent' };
    case 'danger':
      return { bg: colors.danger, fg: colors.onPrimary, border: colors.danger };
    case 'primary':
    default:
      return { bg: colors.primary, fg: colors.onPrimary, border: colors.primary };
  }
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
