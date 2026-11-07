import React, { useState } from 'react';
import { Pressable, StyleProp, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { MIN_TARGET, useTheme } from '../theme';
import { Text } from './Text';

export type TextFieldProps = Omit<TextInputProps, 'style' | 'accessibilityLabel' | 'editable'> & {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  helper?: string;
  disabled?: boolean;
  multiline?: boolean;
  /** Pour un champ mot de passe : textes des boutons afficher / masquer. */
  passwordToggleLabels?: { show: string; hide: string };
  testID?: string;
  containerStyle?: StyleProp<ViewStyle>;
};

/**
 * Champ de saisie : texte, mot de passe (`secureTextEntry`), multiligne.
 * États : default, focus, erreur, désactivé. Le libellé reste visible (pas seulement un placeholder).
 */
export function TextField({
  label,
  value,
  onChangeText,
  error,
  helper,
  disabled = false,
  multiline = false,
  secureTextEntry,
  passwordToggleLabels,
  testID,
  containerStyle,
  onFocus,
  onBlur,
  ...rest
}: TextFieldProps) {
  const { colors, radius, space } = useTheme();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const isPassword = Boolean(secureTextEntry);
  const description = error ?? helper;

  const borderColor = error ? colors.danger : focused ? colors.primary : colors.borderStrong;

  return (
    <View style={containerStyle}>
      <Text variant="caption" tone={error ? 'danger' : 'textMuted'} style={{ marginBottom: space[1], fontWeight: '600' }}>
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          minHeight: MIN_TARGET + 4,
          borderRadius: radius.md,
          borderWidth: focused || error ? 2 : 1,
          borderColor,
          backgroundColor: disabled ? colors.disabledBg : colors.surface,
          paddingHorizontal: space[3],
        }}
      >
        <TextInput
          testID={testID}
          accessibilityLabel={label}
          accessibilityHint={description}
          accessibilityState={{ disabled }}
          editable={!disabled}
          value={value}
          onChangeText={onChangeText}
          multiline={multiline}
          secureTextEntry={isPassword && !revealed}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={{
            flex: 1,
            minHeight: multiline ? 96 : MIN_TARGET,
            paddingVertical: space[2],
            color: disabled ? colors.disabledText : colors.text,
            fontSize: 16,
            textAlignVertical: multiline ? 'top' : 'center',
          }}
          {...rest}
        />
        {isPassword && passwordToggleLabels ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? passwordToggleLabels.hide : passwordToggleLabels.show}
            onPress={() => setRevealed((r) => !r)}
            disabled={disabled}
            style={{ minHeight: MIN_TARGET, minWidth: MIN_TARGET, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text variant="caption" tone="primary" style={{ fontWeight: '600' }}>
              {revealed ? passwordToggleLabels.hide : passwordToggleLabels.show}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text
          variant="caption"
          tone="danger"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          testID={testID ? `${testID}-error` : undefined}
          style={{ marginTop: space[1] }}
        >
          {error}
        </Text>
      ) : helper ? (
        <Text variant="caption" tone="textMuted" style={{ marginTop: space[1] }}>
          {helper}
        </Text>
      ) : null}
    </View>
  );
}
