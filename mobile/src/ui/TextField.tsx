import React, { useEffect, useState } from 'react';
import { StyleProp, TextInput, TextInputInstance, TextInputProps, View, ViewStyle } from 'react-native';
import { borderWidth, focus, fontFamilyFor, iconSize, MIN_TARGET, useFontsReady, useTheme } from '../theme';
import { announce } from './a11y/announce';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { Text } from './Text';

export type TextFieldProps = Omit<TextInputProps, 'style' | 'accessibilityLabel' | 'editable'> & {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  helper?: string;
  disabled?: boolean;
  multiline?: boolean;
  /** Marque le champ en erreur (bordure et libellé) sans afficher de message : le message est porté par le parent. */
  invalid?: boolean;
  /**
   * Pour un champ mot de passe : libellés accessibles complets (`show`, `hide`) du bouton afficher / masquer
   * (IconButton Eye / EyeOff).
   */
  passwordToggleLabels?: { show: string; hide: string };
  /** Référence du champ natif, pour enchaîner le focus d'un champ au suivant. */
  inputRef?: React.Ref<TextInputInstance>;
  testID?: string;
  containerStyle?: StyleProp<ViewStyle>;
};

/** Hauteur minimale du cadre d'un champ (jeton MIN_TARGET + 8 = 52 pt). */
const FIELD_MIN_HEIGHT = MIN_TARGET + 8;
/** Hauteur minimale de la saisie multiligne (environ quatre lignes). */
const MULTILINE_MIN_HEIGHT = 96;

/**
 * Champ de saisie : texte, mot de passe (`secureTextEntry`), multiligne.
 * États : default, focus, erreur, désactivé. Le libellé reste visible (pas seulement un placeholder).
 * Focus : contour 2 pt `colors.focusRing`. Erreur : icône + texte sous le champ (la couleur ne porte jamais seule le message).
 */
export function TextField({
  label,
  value,
  onChangeText,
  error,
  helper,
  disabled = false,
  multiline = false,
  invalid = false,
  secureTextEntry,
  passwordToggleLabels,
  inputRef,
  testID,
  containerStyle,
  onFocus,
  onBlur,
  ...rest
}: TextFieldProps) {
  const { colors, radius, space, type } = useTheme();
  const fontsReady = useFontsReady();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const isPassword = Boolean(secureTextEntry);
  const description = error ?? helper;
  const hasError = Boolean(error) || invalid;

  // iOS n'a pas de région vivante : un nouveau message d'erreur est annoncé au lecteur d'écran (Android : région vivante).
  useEffect(() => {
    if (error) announce(`${label}. ${error}`);
  }, [error, label]);

  const borderColor = hasError ? colors.danger : focused ? colors[focus.color] : colors.borderStrong;

  return (
    <View style={containerStyle}>
      <Text variant="labelStrong" tone={hasError ? 'danger' : 'text'} style={{ marginBottom: space[1] }}>
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          minHeight: FIELD_MIN_HEIGHT,
          borderRadius: radius.md,
          // Trait constant (2 pt) : le focus ou l'erreur ne décalent pas le contenu, seule la couleur change.
          borderWidth: borderWidth.strong,
          borderColor,
          backgroundColor: disabled ? colors.disabledBg : colors.surface,
          paddingHorizontal: space[3],
        }}
      >
        <TextInput
          ref={inputRef}
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
            minHeight: multiline ? MULTILINE_MIN_HEIGHT : MIN_TARGET,
            paddingVertical: space[2],
            color: disabled ? colors.disabledText : colors.text,
            fontSize: type.body.size,
            ...(fontsReady ? { fontFamily: fontFamilyFor(type.body.weight) } : null),
            textAlignVertical: multiline ? 'top' : 'center',
            // Le contour du cadre porte le focus : pas de second contour du navigateur sur la saisie.
            outlineWidth: 0,
          }}
          {...rest}
        />
        {isPassword && passwordToggleLabels ? (
          <IconButton
            testID={testID ? `${testID}-toggle` : undefined}
            icon={revealed ? 'EyeOff' : 'Eye'}
            accessibilityLabel={revealed ? passwordToggleLabels.hide : passwordToggleLabels.show}
            onPress={() => setRevealed((r) => !r)}
            disabled={disabled}
          />
        ) : null}
      </View>
      {error ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[1], marginTop: space[1] }}>
          <View style={{ marginTop: (type.bodySmall.line - iconSize.sm) / 2 }}>
            <Icon name="CircleAlert" size="sm" tone="danger" />
          </View>
          <Text
            variant="bodySmall"
            tone="danger"
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            testID={testID ? `${testID}-error` : undefined}
            style={{ flex: 1 }}
          >
            {error}
          </Text>
        </View>
      ) : helper ? (
        <Text variant="bodySmall" tone="textMuted" style={{ marginTop: space[1] }}>
          {helper}
        </Text>
      ) : null}
    </View>
  );
}
