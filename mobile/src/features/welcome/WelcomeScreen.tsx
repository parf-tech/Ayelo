import { useRouter } from 'expo-router';
import React from 'react';
import { ImageSourcePropType, View } from 'react-native';
import { SIGNUP_ROUTES } from '../../flow/signupMachine';
import { useSignupFlow } from '../../flow/SignupFlowProvider';
import { setSessionNotice, useSessionNotice } from '../../auth/sessionNotice';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';
import { LanguageToggle } from '../common/LanguageToggle';
import { Banner, Button, Logo, ScreenContainer, Text } from '../../ui';
import { setDeletionNotice, useDeletionNotice } from '../settings/deletionNotice';
import { WelcomeBackdrop } from '../../ui/illustrations/WelcomeBackdrop';
import { LOGO_VARIANTS, isOnBrandVariant } from '../../ui/brandArt';
import { WelcomeBenefits } from './WelcomeBenefits';

/** Variante du logo destinée aux fonds de marque (blanche). */
const LOGO_ON_BRAND = LOGO_VARIANTS.find(isOnBrandVariant) ?? 'color';

/** Hauteur du logo blanc (symbole + mot-symbole) en pt. */
const WELCOME_LOGO_SIZE = 72;

export type WelcomeScreenProps = {
  /**
   * Emplacement d'une photographie d'ambiance SOUS LICENCE (aucune n'est livrée). Voir `WelcomeBackdrop`.
   * Non renseigné : fond prune et dégradé, sans visage. `app/(public)/index.tsx` ne le renseigne pas.
   */
  heroImage?: ImageSourcePropType;
  heroImageLabel?: string;
};

/**
 * S01 : accueil, toujours sur fond prune (`colors.brand`, identique en clair et en sombre).
 * Deux entrées : connexion (F00, sans S63 ni S68) et inscription (F01 : S68 -> S63 -> S02). Aucune connexion sociale
 * (décision 2), aucune pagination : l'accueil est un seul écran.
 */
export function WelcomeScreen({ heroImage, heroImageLabel }: WelcomeScreenProps = {}) {
  const router = useRouter();
  const { t } = useI18n();
  const { space } = useTheme();
  const { dispatch } = useSignupFlow();
  const deletion = useDeletionNotice();
  const sessionExpired = useSessionNotice();

  const startSignup = () => {
    dispatch({ type: 'RESET' });
    router.push(SIGNUP_ROUTES.birthdate as never);
  };

  return (
    <ScreenContainer
      scroll
      tone="brand"
      backdrop={<WelcomeBackdrop heroImage={heroImage} heroImageLabel={heroImageLabel} />}
      testID="screen-welcome"
      contentStyle={{ justifyContent: 'center' }}
      footer={
        <View style={{ gap: space[3] }}>
          <Button testID="welcome-create-account" tone="onBrand" label={t('welcome.cta.create')} onPress={startSignup} />
          <Button
            testID="welcome-sign-in"
            variant="secondary"
            tone="onBrand"
            label={t('welcome.cta.haveAccount')}
            onPress={() => router.push('/login' as never)}
          />
          {__DEV__ ? (
            <Button
              variant="ghost"
              tone="onBrand"
              label={t('welcome.demo')}
              onPress={() => router.push('/components-demo' as never)}
            />
          ) : null}
        </View>
      }
    >
      <LanguageToggle tone="onBrand" />
      {deletion ? (
        <Banner
          testID="welcome-deletion-notice"
          variant="info"
          message={t('delete.notice', { days: deletion.days })}
          onDismiss={() => setDeletionNotice(null)}
          dismissLabel={t('ui.banner.dismiss')}
          style={{ marginTop: space[3] }}
        />
      ) : null}
      {sessionExpired ? (
        <Banner
          testID="welcome-session-notice"
          variant="info"
          message={t('error.unauthorized')}
          onDismiss={() => setSessionNotice(false)}
          dismissLabel={t('ui.banner.dismiss')}
          style={{ marginTop: space[3] }}
        />
      ) : null}
      <View style={{ alignItems: 'center', paddingVertical: space[5] }}>
        <Logo variant={LOGO_ON_BRAND} layout="horizontal" size={WELCOME_LOGO_SIZE} testID="welcome-logo" />
        <Text
          variant="title"
          header
          tone="onBrand"
          align="center"
          style={{ marginTop: space[5] }}
          testID="welcome-tagline"
        >
          {t('welcome.tagline')}
        </Text>
        <Text variant="body" tone="onBrand" align="center" style={{ marginTop: space[3] }}>
          {t('welcome.subtitle')}
        </Text>
        <View style={{ alignSelf: 'stretch', marginTop: space[6] }}>
          <WelcomeBenefits />
        </View>
        <Text variant="caption" tone="onBrand" align="center" style={{ marginTop: space[5] }}>
          {t('welcome.safety')}
        </Text>
      </View>
    </ScreenContainer>
  );
}
