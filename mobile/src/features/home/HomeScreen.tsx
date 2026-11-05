import React, { useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';
import { Button, ScreenContainer, Skeleton, Text } from '../../ui';
import { LanguageToggle } from '../common/LanguageToggle';

/** Écran connecté provisoire (la découverte S10 viendra avec les routes /discover et /swipes). */
export function HomeScreen() {
  const { t } = useI18n();
  const { space } = useTheme();
  const { state, signOut } = useAuth();
  const [loading, setLoading] = useState(false);

  const logout = async () => {
    setLoading(true);
    try {
      await signOut();
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer
      testID="screen-home"
      footer={<Button testID="home-logout" variant="secondary" label={t('home.logout')} onPress={logout} loading={loading} />}
    >
      <LanguageToggle />
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text variant="title" header>
          {t('home.title')}
        </Text>
        {state.user ? (
          <Text variant="body" tone="textMuted" style={{ marginTop: space[3] }} testID="home-user">
            {t('home.signedInAs', { email: state.user.email })}
          </Text>
        ) : (
          <Skeleton width="70%" style={{ marginTop: space[3] }} />
        )}
        <Text variant="caption" tone="textMuted" style={{ marginTop: space[4] }}>
          {t('home.provisional')}
        </Text>
      </View>
    </ScreenContainer>
  );
}
