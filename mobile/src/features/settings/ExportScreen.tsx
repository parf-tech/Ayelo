import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { isApiError } from '../../api/errors';
import type { DataExport } from '../../api/types';
import { useAuth } from '../../auth/AuthProvider';
import { availableOAuthProviders, type OAuthProof } from '../../auth/oauthProof';
import { useI18n } from '../../i18n';
import { apiErrorMessage } from '../../i18n/apiErrors';
import { useTheme } from '../../theme';
import { Banner, Button, ScreenContainer, Skeleton, Text, TextField } from '../../ui';
import { passwordToggleLabels } from '../common/passwordToggle';
import { ScreenHeader } from '../common/ScreenHeader';
import { openExternal } from '../legal/links';
import { SocialReauth } from './SocialReauth';

export const EXPORT_POLL_MS = 5000;

/** S67 : export des données (POST /me/export puis GET /me/export/{id} jusqu'à « ready »). Une demande par jour. */
export function ExportScreen() {
  const { t, locale } = useI18n();
  const { space, colors, radius } = useTheme();
  const { api } = useAuth();
  const [job, setJob] = useState<DataExport | null>(null);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<string | undefined>();
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [social, setSocial] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  const pollRef = useRef<(id: string) => Promise<void>>(async () => undefined);
  const poll = useCallback(
    async (id: string) => {
      try {
        const next = await api.auth.getExport(id);
        if (!alive.current) return;
        setJob(next);
        if (next.status === 'pending') timer.current = setTimeout(() => void pollRef.current(id), EXPORT_POLL_MS);
      } catch (error) {
        if (!alive.current) return;
        const { key, params } = apiErrorMessage(error);
        setBanner(t(key, params));
      }
    },
    [api, t],
  );

  useEffect(() => {
    pollRef.current = poll;
  });

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const request = async (proof?: OAuthProof) => {
    setBanner(undefined);
    if (!proof && password === '') {
      setPasswordError(t('export.passwordRequired'));
      return;
    }
    setPasswordError(undefined);
    setLoading(true);
    try {
      // Ré-authentification comme DELETE /me : le mot de passe n'est jamais conservé.
      const created = await api.auth.requestExport(proof ?? { password });
      setPassword('');
      setJob(created);
      timer.current = setTimeout(() => void poll(created.id), EXPORT_POLL_MS);
    } catch (error) {
      if (isApiError(error) && error.isValidation && (error.fieldError('provider') || error.fieldError('id_token'))) {
        setSocial(true);
        setBanner(availableOAuthProviders().length === 0 ? t('export.social') : undefined);
      } else if (isApiError(error) && error.status === 403 && error.code === 'invalid_credentials') {
        setPasswordError(t('export.wrongPassword'));
      } else {
        const { key, params } = apiErrorMessage(error);
        setBanner(t(key, params));
      }
    } finally {
      setLoading(false);
    }
  };

  const expires = job?.expires_at
    ? new Date(job.expires_at).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <ScreenContainer scroll testID="screen-export">
      <ScreenHeader title={t('export.title')} fallbackHref="/settings" />
      <View style={{ gap: space[6] }}>
        <View style={{ gap: space[3] }}>
          <Text variant="body" tone="textMuted">
            {t('export.body')}
          </Text>
          {banner ? <Banner testID="export-banner" variant="error" message={banner} onDismiss={() => setBanner(undefined)} dismissLabel={t('ui.banner.dismiss')} /> : null}
        </View>
        {!job ? (
          <View style={{ gap: space[4] }}>
            {social ? <SocialReauth testID="export-reauth" disabled={loading} onProof={(proof) => request(proof)} /> : null}
            <TextField
              testID="export-password"
              label={t('export.password')}
              helper={t('export.passwordHelp')}
              value={password}
              onChangeText={setPassword}
              error={passwordError}
              disabled={loading}
              secureTextEntry
              passwordToggleLabels={passwordToggleLabels(t)}
              autoCapitalize="none"
              autoComplete="current-password"
              returnKeyType="done"
              onSubmitEditing={() => void request()}
            />
            <Button testID="export-request" label={t('export.request')} onPress={() => void request()} loading={loading} />
          </View>
        ) : null}
        {job?.status === 'pending' ? (
          <View style={{ gap: space[3], padding: space[4], borderRadius: radius.md, backgroundColor: colors.surface }}>
            <Text variant="bodyMedium" accessibilityLiveRegion="polite" testID="export-pending">
              {t('export.pending')}
            </Text>
            <Skeleton />
            <Button testID="export-check" variant="ghost" label={t('export.check')} onPress={() => job && void poll(job.id)} />
          </View>
        ) : null}
        {job?.status === 'ready' ? (
          <View style={{ gap: space[4] }}>
            <Banner testID="export-ready" variant="success" message={`${t('export.ready')}${expires ? ` ${t('export.expires', { date: expires })}` : ''}`} />
            <Button
              testID="export-download"
              label={t('export.download')}
              disabled={!job.url}
              onPress={() => job.url && void openExternal(job.url)}
            />
            {!job.url ? (
              <Text variant="bodySmall" tone="textMuted" testID="export-no-url">
                {t('export.noUrl')}
              </Text>
            ) : null}
          </View>
        ) : null}
        {job?.status === 'expired' || job?.status === 'failed' ? (
          <View style={{ gap: space[4] }}>
            <Banner testID="export-failed" variant="error" message={job.status === 'expired' ? t('export.expired') : t('export.failed')} />
            <Button testID="export-new-request" variant="secondary" label={t('export.newRequest')} onPress={() => { setJob(null); }} />
          </View>
        ) : null}
      </View>
    </ScreenContainer>
  );
}
