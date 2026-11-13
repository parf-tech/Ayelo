import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';
import { Banner, Button } from '../../ui';
import { OnboardingFrame } from '../onboarding/OnboardingFrame';
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
    <OnboardingFrame
      testID="screen-photos"
      step="photos"
      backHref="/onboarding/intent"
      title={t('photos.title')}
      subtitle={t('photos.subtitle')}
      footer={<Button testID="photos-continue" label={t('photos.continue')} onPress={next} />}
    >
      <PhotosManager onChange={setState} />
      {hint && !state.hasPhoto ? (
        <Banner testID="photos-hint" variant="error" message={t('photos.needOne')} style={{ marginTop: space[3] }} />
      ) : null}
    </OnboardingFrame>
  );
}
