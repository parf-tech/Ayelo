import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../../i18n';
import { MAX_CONTENT_WIDTH, MIN_TARGET, borderWidth, radius, useTheme } from '../../theme';
import { IconButton, Logo, Stepper, Text } from '../../ui';
import { LOGO_VARIANTS, isOnBrandVariant } from '../../ui/brandArt';
import { BrandStatusBar, FOOTER_MAX_HEIGHT_RATIO, footerScrolls } from '../../ui/ScreenContainer';
import { useGoBack } from '../common/useGoBack';
import { ONBOARDING_STEP_KEYS, ONBOARDING_STEPS, OnboardingStepKey, onboardingStepNumber } from './steps';

/** Variante du logo faite pour le fond de marque (mot-symbole clair). */
const LOGO_ON_BRAND = LOGO_VARIANTS.find(isOnBrandVariant) ?? 'color';

/** Hauteur du logo de l'en-tête d'onboarding, en pt (plus petit que celui de l'accueil, 72). */
const ONBOARDING_LOGO_SIZE = 28;

type Props = {
  testID: string;
  /** Étape du parcours (affiche l'indicateur « Étape n sur 4 »). Absent : écran hors séquence (e-mail). */
  step?: OnboardingStepKey;
  title: string;
  subtitle?: string;
  /** Bouton retour (geste système et bouton Android fonctionnent aussi). Repli si la pile est vide. */
  backHref?: string;
  /** Action principale, en bas, pleine largeur. */
  footer: React.ReactNode;
  children: React.ReactNode;
};

/**
 * Cadre commun des écrans d'onboarding : en-tête de marque (logo, étapes, titre en Poppins Bold) puis panneau clair
 * aux coins supérieurs arrondis qui porte le formulaire ; l'action principale reste en bas, pleine largeur.
 * Le pied de page plafonne sa hauteur et défile avec un texte très agrandi (comme ScreenContainer).
 */
export function OnboardingFrame({ testID, step, title, subtitle, backHref, footer, children }: Props) {
  const { t } = useI18n();
  const goBack = useGoBack(backHref ?? '/');
  const { colors, space } = useTheme();
  const insets = useSafeAreaInsets();
  const { height, fontScale } = useWindowDimensions();
  const largeFont = footerScrolls(height, fontScale);

  const steps = ONBOARDING_STEP_KEYS.map((key) => ({ key, label: t(`onboarding.step.${key}`) }));
  const current = step ? onboardingStepNumber(step) : 0;
  const inner = { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', paddingHorizontal: space[5] } as const;

  return (
    <View testID={testID} style={{ flex: 1, backgroundColor: colors.brand }}>
      {/* En-tête prune en clair comme en sombre : icônes de la barre d'état claires tant que l'écran a le focus. */}
      <BrandStatusBar />
      <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[inner, { paddingTop: space[3], paddingBottom: space[6], gap: space[4] }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: MIN_TARGET }}>
                {backHref ? (
                  <IconButton
                    testID="back-button"
                    icon="ChevronLeft"
                    variant="tonal"
                    tone="onBrand"
                    accessibilityLabel={t('common.back')}
                    onPress={goBack}
                  />
                ) : null}
                <Logo variant={LOGO_ON_BRAND} layout="horizontal" size={ONBOARDING_LOGO_SIZE} />
              </View>
              {step ? (
                <Stepper
                  testID="onboarding-stepper"
                  steps={steps}
                  current={current}
                  label={t('onboarding.progress', { current, total: ONBOARDING_STEPS })}
                  onBrand
                />
              ) : null}
              <View style={{ gap: space[2] }}>
                <Text variant="title" header tone="onBrand">
                  {title}
                </Text>
                {subtitle ? (
                  <Text variant="body" tone="onBrand">
                    {subtitle}
                  </Text>
                ) : null}
              </View>
            </View>
            <View
              style={{
                flexGrow: 1,
                width: '100%',
                maxWidth: MAX_CONTENT_WIDTH,
                alignSelf: 'center',
                backgroundColor: colors.bg,
                borderTopLeftRadius: radius.lg,
                borderTopRightRadius: radius.lg,
                paddingHorizontal: space[5],
                paddingTop: space[5],
                paddingBottom: space[6],
              }}
            >
              {children}
            </View>
          </ScrollView>
          <View
            testID={`${testID}-footer`}
            style={{
              backgroundColor: colors.bg,
              borderTopWidth: borderWidth.hairline,
              borderTopColor: colors.border,
              maxHeight: Math.round(height * FOOTER_MAX_HEIGHT_RATIO),
              paddingBottom: Math.max(insets.bottom, largeFont ? space[2] : space[4]),
            }}
          >
            <View style={[inner, { paddingTop: largeFont ? space[2] : space[3], flexShrink: 1 }]}>
              {largeFont ? (
                <ScrollView
                  testID={`${testID}-footer-scroll`}
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
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
