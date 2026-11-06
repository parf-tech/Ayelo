import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { REPORT_REASONS, type ReportContextType, type ReportReason } from '../../api/types';
import { useAuth } from '../../auth/AuthProvider';
import { useI18n } from '../../i18n';
import { apiErrorMessage } from '../../i18n/apiErrors';
import { useTheme } from '../../theme';
import { Banner, Button, ScreenContainer, Text, TextField, useToast } from '../../ui';
import { ScreenHeader } from '../common/ScreenHeader';

const CONTEXTS: readonly ReportContextType[] = ['profile', 'conversation', 'message', 'call', 'story'];

/**
 * S58 : signalement. Depuis le menu (1 tap), « Signaler » (2e tap), puis un motif (3e tap) envoie le signalement :
 * les détails facultatifs se saisissent avant de choisir le motif.
 */
export function ReportScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { space } = useTheme();
  const toast = useToast();
  const { api } = useAuth();
  const params = useLocalSearchParams<{ reportedId?: string; name?: string; contextType?: string; contextId?: string }>();
  const reportedId = typeof params.reportedId === 'string' ? params.reportedId : '';
  const contextType = CONTEXTS.find((c) => c === params.contextType);
  const contextId = typeof params.contextId === 'string' && params.contextId ? params.contextId : undefined;
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState<ReportReason | null>(null);
  const [error, setError] = useState<string | undefined>();

  const send = async (reason: ReportReason) => {
    if (sending || !reportedId) return;
    setSending(reason);
    setError(undefined);
    try {
      const result = await api.safety.report({
        reported_id: reportedId,
        reason,
        details: details.trim() === '' ? undefined : details.trim(),
        context_type: contextType,
        context_id: contextType ? contextId : undefined,
      });
      toast.show({ message: result.status === 'already_reported' ? t('report.already') : t('report.sent'), variant: 'success' });
      if (router.canGoBack()) router.back();
    } catch (e) {
      const { key, params: p } = apiErrorMessage(e);
      setError(t(key, p));
    } finally {
      setSending(null);
    }
  };

  return (
    <ScreenContainer scroll testID="screen-report">
      <ScreenHeader title={t('report.title')} />
      <Text variant="body" tone="textMuted" style={{ marginBottom: space[3] }}>
        {t('report.subtitle')}
      </Text>
      {error ? <Banner testID="report-error" variant="error" message={error} style={{ marginBottom: space[3] }} /> : null}
      <TextField
        testID="report-details"
        label={t('report.details')}
        value={details}
        onChangeText={setDetails}
        multiline
        maxLength={1000}
        containerStyle={{ marginBottom: space[4] }}
      />
      <View style={{ gap: space[2] }}>
        {REPORT_REASONS.map((reason) => (
          <Button
            key={reason}
            testID={`report-${reason}`}
            variant="secondary"
            label={t(`report.reason.${reason}`)}
            onPress={() => void send(reason)}
            loading={sending === reason}
            loadingLabel={t('report.sending')}
            disabled={sending !== null && sending !== reason}
          />
        ))}
      </View>
    </ScreenContainer>
  );
}
