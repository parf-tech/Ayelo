import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleProp, StyleSheet, View, ViewStyle, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MAX_CONTENT_WIDTH, useTheme } from '../theme';

export type ScreenContainerProps = {
  children: React.ReactNode;
  /** Contenu défilant (formulaires). Sinon, le contenu occupe l'écran. */
  scroll?: boolean;
  /** Zone fixe en bas (actions principales : le pouce d'abord, docs/06). */
  footer?: React.ReactNode;
  testID?: string;
  contentStyle?: StyleProp<ViewStyle>;
  /** `brand` : fond prune pleine page (accueil), identique en clair et en sombre ; pied de page sans filet. Défaut `default`. */
  tone?: 'default' | 'brand';
  /** Décor plein cadre derrière le contenu (dégradé, image) : décoratif, jamais interactif ni lu par les lecteurs d'écran. */
  backdrop?: React.ReactNode;
};

/** Au-delà de ce facteur d'agrandissement du texte, le pied de page se compacte et défile s'il dépasse son plafond. */
export const LARGE_FONT_SCALE = 1.3;
/** Part maximale de la hauteur de l'écran occupée par le pied de page : le contenu garde toujours de la place. */
export const FOOTER_MAX_HEIGHT_RATIO = 0.45;

/**
 * Conteneur d'écran : zones sûres, fond du thème, clavier, largeur centrée sur tablette.
 * Le pied de page plafonne sa hauteur ; avec un texte très agrandi il se compacte et défile pour ne rien couper.
 */
export function ScreenContainer({
  children,
  scroll = false,
  footer,
  testID,
  contentStyle,
  tone = 'default',
  backdrop,
}: ScreenContainerProps) {
  const { colors, space } = useTheme();
  const { height, fontScale } = useWindowDimensions();
  const largeFont = fontScale >= LARGE_FONT_SCALE;
  const background = tone === 'brand' ? colors.brand : colors.bg;

  const inner: ViewStyle = {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: space[5],
  };

  return (
    <SafeAreaView testID={testID} style={{ flex: 1, backgroundColor: background }}>
      {backdrop ? (
        <View
          testID={testID ? `${testID}-backdrop` : 'screen-backdrop'}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={StyleSheet.absoluteFill}
        >
          {backdrop}
        </View>
      ) : null}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[inner, { paddingTop: space[5], paddingBottom: space[5], flexGrow: 1 }, contentStyle]}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[inner, { flex: 1, paddingTop: space[5] }, contentStyle]}>{children}</View>
        )}
        {footer ? (
          <View
            testID={testID ? `${testID}-footer` : 'screen-footer'}
            style={{
              ...inner,
              paddingTop: largeFont ? space[2] : space[3],
              paddingBottom: largeFont ? space[2] : space[4],
              borderTopWidth: tone === 'brand' ? 0 : 1,
              borderTopColor: colors.border,
              backgroundColor: backdrop ? 'transparent' : background,
              maxHeight: Math.round(height * FOOTER_MAX_HEIGHT_RATIO),
            }}
          >
            {largeFont ? (
              <ScrollView
                testID={testID ? `${testID}-footer-scroll` : 'screen-footer-scroll'}
                style={{ flexGrow: 0 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {footer}
              </ScrollView>
            ) : (
              footer
            )}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
