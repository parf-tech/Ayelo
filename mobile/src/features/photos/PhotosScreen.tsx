import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';
import { Button, ProgressBar, ScreenContainer, Text } from '../../ui';
import { BackButton } from '../common/BackButton';
import { ONBOARDING_STEPS } from '../onboarding/steps';
import { PhotosManager, type PhotosState } from './PhotosManager';

/** S06 (onboarding) : 1 à 6 photos ; « Continuer » exige au moins une photo (en revue ou approuvée). */
export function PhotosScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { space } = useTheme();
  const [state, setState] = useState<PhotosState>({ count: 0, hasPhoto: false, ready: false });
  const [hint, setHint] = useState(false);

  const next = () => {
    if (!state.hasPhoto) {
      setHint(true);
      return;
    }
    router.push('/onboarding/preferences' as never);
  };

  return (
    <ScreenContainer
      scroll
      testID="screen-photos"
      footer={<Button testID="photos-continue" label={t('photos.continue')} onPress={next} />}
    >
      <ProgressBar current={3} total={ONBOARDING_STEPS} label={t('onboarding.progress', { current: 3, total: ONBOARDING_STEPS })} />
      <BackButton fallbackHref="/onboarding/intent" />
      <Text variant="title" header>
        {t('photos.title')}
      </Text>
      <Text variant="body" tone="textMuted" style={{ marginTop: space[2], marginBottom: space[3] }}>
        {t('photos.subtitle')}
      </Text>
      <PhotosManager onChange={setState} />
      {hint && !state.hasPhoto ? (
        <Text variant="caption" tone="danger" accessibilityRole="alert" style={{ marginTop: space[3] }}>
          {t('photos.needOne')}
        </Text>
      ) : null}
    </ScreenContainer>
  );
}
