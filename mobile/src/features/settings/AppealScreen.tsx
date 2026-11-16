import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { useI18n } from '../../i18n';
import { apiErrorMessage } from '../../i18n/apiErrors';
import { useTheme } from '../../theme';
import { Banner, Button, ScreenContainer, Text, TextField, useToast } from '../../ui';
import { ScreenHeader } from '../common/ScreenHeader';

/** S66 : contestation d'une sanction (POST /appeals, 10 à 2 000 caractères, une seule par sanction). */
export function AppealScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { space } = useTheme();
  const toast = useToast();
  const { api } = useAuth();
  const params = useLocalSearchParams<{ sanctionId?: string }>();
  const sanctionId = typeof params.sanctionId === 'string' ? params.sanctionId : '';
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [banner, setBanner] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setBanner(undefined);
    const length = message.trim().length;
    if (length < 10 || length > 2000) {
      setError(t('appeal.invalid'));
      return;
    }
    setError(undefined);
    setLoading(true);
    try {
      await api.safety.appeal(sanctionId, message.trim());
      toast.show({ message: t('appeal.sent'), variant: 'success' });
      router.back();
    } catch (e) {
      const { key, params: p } = apiErrorMessage(e);
      setBanner(t(key, p));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer
      scroll
      testID="screen-appeal"
      footer={<Button testID="appeal-send" label={t('appeal.send')} onPress={() => void submit()} loading={loading} disabled={!sanctionId} />}
    >
      <ScreenHeader title={t('appeal.title')} fallbackHref="/settings/sanctions" />
      <View style={{ gap: space[6] }}>
        <Text variant="body" tone="textMuted">
          {t('appeal.subtitle')}
        </Text>
        <View style={{ gap: space[4] }}>
          {banner ? <Banner testID="appeal-banner" variant="error" message={banner} /> : null}
          <TextField testID="appeal-message" label={t('appeal.message')} value={message} onChangeText={setMessage} error={error} multiline maxLength={2000} disabled={loading} />
        </View>
      </View>
    </ScreenContainer>
  );
}
