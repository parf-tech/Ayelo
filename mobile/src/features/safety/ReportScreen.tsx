import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { REPORT_REASONS, type ReportContextType, type ReportReason } from '../../api/types';
import { useAuth } from '../../auth/AuthProvider';
import { useI18n } from '../../i18n';
import { apiErrorMessage } from '../../i18n/apiErrors';
import { borderWidth, useTheme } from '../../theme';
import { Banner, Button, ChoiceCard, Icon, ScreenContainer, Text, TextField, useToast } from '../../ui';
import { ScreenHeader } from '../common/ScreenHeader';
import { useGoBack } from '../common/useGoBack';

const CONTEXTS: readonly ReportContextType[] = ['profile', 'conversation', 'message', 'call', 'story'];

/**
 * S58 : signalement. On choisit un motif (cartes radio), on peut ajouter des détails, puis « Envoyer le signalement »
 * confirme explicitement : un toucher accidentel sur un motif n'envoie jamais rien.
 */
export function ReportScreen() {
  const goBack = useGoBack('/discover');
  const { t } = useI18n();
  const { space, colors, radius } = useTheme();
  const toast = useToast();
  const { api } = useAuth();
  const params = useLocalSearchParams<{ reportedId?: string; name?: string; contextType?: string; contextId?: string }>();
  const reportedId = typeof params.reportedId === 'string' ? params.reportedId : '';
  const contextType = CONTEXTS.find((c) => c === params.contextType);
  const contextId = typeof params.contextId === 'string' && params.contextId ? params.contextId : undefined;
  const [details, setDetails] = useState('');
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const send = async () => {
    if (sending || !reportedId || !reason) return;
    setSending(true);
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
      // Sans écran précédent (ouverture par lien), on revient à la découverte plutôt que de laisser le formulaire ouvert.
      goBack();
    } catch (e) {
      const { key, params: p } = apiErrorMessage(e);
      setError(t(key, p));
    } finally {
      setSending(false);
    }
  };

  return (
    <ScreenContainer scroll testID="screen-report">
      <ScreenHeader title={t('report.title')} />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: space[3],
          padding: space[4],
          marginBottom: space[4],
          borderRadius: radius.lg,
          backgroundColor: colors.surface,
          borderWidth: borderWidth.hairline,
          borderColor: colors.border,
        }}
      >
        <Icon name="ShieldCheck" tone="primary" />
        <Text variant="body" tone="textMuted" style={{ flex: 1 }}>
          {t('report.subtitle')}
        </Text>
      </View>
      {error ? <Banner testID="report-error" variant="error" message={error} style={{ marginBottom: space[3] }} /> : null}
      <View accessibilityRole="radiogroup" accessibilityLabel={t('report.title')} style={{ gap: space[2], marginBottom: space[4] }}>
        {REPORT_REASONS.map((r) => (
          <ChoiceCard
            key={r}
            testID={`report-${r}`}
            label={t(`report.reason.${r}`)}
            selected={reason === r}
            disabled={sending}
            onPress={() => setReason(r)}
          />
        ))}
      </View>
      <TextField
        testID="report-details"
        label={t('report.details')}
        value={details}
        onChangeText={setDetails}
        multiline
        maxLength={1000}
        containerStyle={{ marginBottom: space[4] }}
      />
      <Button
        testID="report-send"
        label={t('report.send')}
        onPress={() => void send()}
        disabled={!reason}
        loading={sending}
        loadingLabel={t('report.sending')}
      />
      {!reason ? (
        <Text variant="bodySmall" tone="textMuted" style={{ marginTop: space[2] }} testID="report-choose">
          {t('report.choose')}
        </Text>
      ) : null}
    </ScreenContainer>
  );
}
