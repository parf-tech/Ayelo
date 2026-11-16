import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { useI18n } from '../../i18n';
import { apiErrorMessage } from '../../i18n/apiErrors';
import { useTheme } from '../../theme';
import { announce, Banner, Button } from '../../ui';
import { OnboardingFrame } from '../onboarding/OnboardingFrame';

const RESEND_COOLDOWN_SECONDS = 60;

/**
 * S03 : écran d'attente de la vérification d'e-mail. Non bloquant : on peut continuer et confirmer plus tard.
 * « J'ai confirmé » recharge GET /me ; « Renvoyer » appelle POST /auth/email/resend (délai de 60 s entre deux envois).
 */
export function VerifyEmailScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { space } = useTheme();
  const { api, state, refreshMe } = useAuth();
  const [info, setInfo] = useState<{ variant: 'success' | 'info' | 'error'; message: string } | undefined>();
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );

  const goOn = (profileExists: boolean) =>
    router.replace((profileExists ? '/onboarding/photos' : '/onboarding/profile') as never);

  // Compte déjà vérifié (reprise de l'onboarding) : on enchaîne sans attendre.
  const verified = state.user?.email_verified === true;
  useEffect(() => {
    if (verified) goOn(Boolean(state.user?.profile));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verified]);

  // La bannière `info` n'est pas annoncée d'office (iOS n'a pas de région vivante) : le résultat de « J'ai confirmé » l'est ici.
  useEffect(() => {
    if (info?.variant === 'info') announce(info.message);
  }, [info]);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN_SECONDS);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setCooldown((value) => {
        if (value <= 1) {
          if (timer.current) clearInterval(timer.current);
          timer.current = null;
          return 0;
        }
        return value - 1;
      });
    }, 1000);
  };

  const check = async () => {
    setChecking(true);
    setInfo(undefined);
    const me = await refreshMe();
    setChecking(false);
    if (me?.email_verified) {
      setInfo({ variant: 'success', message: t('verifyEmail.verified') });
      goOn(Boolean(me.profile));
    } else {
      setInfo({ variant: me ? 'info' : 'error', message: me ? t('verifyEmail.notYet') : t('error.network') });
    }
  };

  const resend = async () => {
    setResending(true);
    setInfo(undefined);
    try {
      await api.auth.resendEmail();
      setInfo({ variant: 'success', message: t('verifyEmail.resent') });
      startCooldown();
    } catch (error) {
      const { key, params } = apiErrorMessage(error);
      setInfo({ variant: 'error', message: t(key, params) });
    } finally {
      setResending(false);
    }
  };

  const email = state.user?.email;

  return (
    <OnboardingFrame
      testID="screen-verify-email"
      title={t('verifyEmail.title')}
      subtitle={email ? t('verifyEmail.body', { email }) : t('verifyEmail.bodyNoEmail')}
      footer={
        <View style={{ gap: space[2] }}>
          <Button testID="verify-check" label={t('verifyEmail.check')} onPress={() => void check()} loading={checking} />
          <Button testID="verify-skip" variant="ghost" label={t('verifyEmail.skip')} onPress={() => goOn(Boolean(state.user?.profile))} />
        </View>
      }
    >
      <View style={{ gap: space[4] }}>
        {info ? <Banner testID="verify-banner" variant={info.variant} message={info.message} /> : null}
        <View style={{ gap: space[3] }}>
          {/* Libellé d'accessibilité stable : le décompte change chaque seconde et ne doit pas être relu à chaque fois. */}
          <Button
            testID="verify-resend"
            variant="secondary"
            label={cooldown > 0 ? t('verifyEmail.resendWait', { seconds: cooldown }) : t('verifyEmail.resend')}
            accessibilityLabel={t('verifyEmail.resend')}
            accessibilityHint={cooldown > 0 ? t('verifyEmail.resendWait', { seconds: cooldown }) : undefined}
            onPress={() => void resend()}
            loading={resending}
            disabled={cooldown > 0}
          />
        </View>
      </View>
    </OnboardingFrame>
  );
}
