import React, { useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { useResource } from '../../hooks/useResource';
import { useI18n } from '../../i18n';
import { apiErrorMessage } from '../../i18n/apiErrors';
import { useTheme } from '../../theme';
import { AsyncView, Banner, Button, ListRow, ScreenContainer, Text, TextField, useToast } from '../../ui';
import { ScreenHeader } from '../common/ScreenHeader';
import { getLegalLinks, openExternal } from '../legal/links';

/** S56 : aide et assistance (POST /support/tickets, GET /support/tickets). */
export function SupportScreen() {
  const { t, locale } = useI18n();
  const { space } = useTheme();
  const toast = useToast();
  const { api } = useAuth();
  const tickets = useResource(() => api.safety.supportTickets(), [api]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [errors, setErrors] = useState<{ subject?: string; body?: string }>({});
  const [banner, setBanner] = useState<string | undefined>();
  const [sending, setSending] = useState(false);
  const email = getLegalLinks().supportEmail;

  const submit = async () => {
    setBanner(undefined);
    const next = {
      subject: subject.trim().length >= 3 && subject.trim().length <= 120 ? undefined : t('support.subject.invalid'),
      body: body.trim().length >= 5 && body.trim().length <= 4000 ? undefined : t('support.body.invalid'),
    };
    setErrors(next);
    if (next.subject || next.body) return;
    setSending(true);
    try {
      await api.safety.createSupportTicket(subject.trim(), body.trim());
      toast.show({ message: t('support.sent'), variant: 'success' });
      setSubject('');
      setBody('');
      await tickets.reload({ silent: true });
    } catch (error) {
      const { key, params } = apiErrorMessage(error);
      setBanner(t(key, params));
    } finally {
      setSending(false);
    }
  };

  const statusLabel = (status: string) =>
    status === 'open' ? t('support.status.open') : status === 'closed' ? t('support.status.closed') : t('support.status.other');

  return (
    <ScreenContainer scroll testID="screen-support">
      <ScreenHeader title={t('support.title')} fallbackHref="/settings" />
      {/* Deux groupes séparés par l'espace (32) : le formulaire d'envoi, puis les demandes déjà faites. */}
      <View style={{ gap: space[6] }}>
        <View style={{ gap: space[4] }}>
          {banner ? <Banner testID="support-banner" variant="error" message={banner} onDismiss={() => setBanner(undefined)} dismissLabel={t('ui.banner.dismiss')} /> : null}
          <TextField testID="support-subject" label={t('support.subject')} value={subject} onChangeText={setSubject} error={errors.subject} maxLength={120} disabled={sending} />
          <TextField
            testID="support-body"
            label={t('support.body')}
            helper={t('common.counter', { count: body.length, max: 4000 })}
            value={body}
            onChangeText={setBody}
            error={errors.body}
            multiline
            maxLength={4000}
            disabled={sending}
          />
          <View style={{ gap: space[2] }}>
            <Button testID="support-send" label={t('support.send')} onPress={() => void submit()} loading={sending} />
            {email ? (
              <Button variant="ghost" label={t('support.email', { email })} onPress={() => void openExternal(`mailto:${email}`)} />
            ) : null}
          </View>
        </View>
        <View style={{ gap: space[3] }}>
          <Text variant="h3" header>
            {t('support.tickets')}
          </Text>
          <AsyncView
            testID="tickets"
            status={tickets.status}
            error={tickets.error}
            onRetry={() => void tickets.reload()}
            empty={(tickets.data?.data.length ?? 0) === 0}
            emptyTitle={t('support.tickets.empty')}
            skeletonRows={2}
          >
            {(tickets.data?.data ?? []).map((ticket) => (
              <ListRow
                key={ticket.id}
                label={ticket.subject}
                description={`${statusLabel(ticket.status)} · ${new Date(ticket.created_at).toLocaleDateString(locale)}`}
              />
            ))}
          </AsyncView>
        </View>
      </View>
    </ScreenContainer>
  );
}
