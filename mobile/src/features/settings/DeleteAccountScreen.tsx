import React, { useState } from 'react';
import { isApiError } from '../../api/errors';
import { useAuth } from '../../auth/AuthProvider';
import { useI18n } from '../../i18n';
import { apiErrorMessage } from '../../i18n/apiErrors';
import { useTheme } from '../../theme';
import { Banner, Button, ScreenContainer, Text, TextField } from '../../ui';
import { ScreenHeader } from '../common/ScreenHeader';

/**
 * S55 : suppression du compte avec ré-authentification (DELETE /me). Mot de passe pour un compte e-mail ;
 * pour un compte Google / Apple, le serveur exige un jeton frais du fournisseur, non disponible dans cette version :
 * l'écran l'explique et renvoie vers le support.
 */
export function DeleteAccountScreen() {
  const { t } = useI18n();
  const { space } = useTheme();
  const { api, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [banner, setBanner] = useState<{ variant: 'error' | 'warning' | 'success'; message: string } | undefined>();
  const [loading, setLoading] = useState(false);
  const [graceDays, setGraceDays] = useState<number | null>(null);

  const submit = async () => {
    setBanner(undefined);
    if (password === '') {
      setError(t('delete.passwordRequired'));
      return;
    }
    setError(undefined);
    setLoading(true);
    try {
      const result = await api.auth.deleteAccount({ password });
      setGraceDays(result.purge_after_days);
      setBanner({ variant: 'success', message: t('delete.done') });
      await signOut();
    } catch (e) {
      if (isApiError(e) && e.isValidation && (e.fieldError('provider') || e.fieldError('id_token'))) {
        setBanner({ variant: 'warning', message: t('delete.social') });
      } else if (isApiError(e) && e.status === 403 && e.code === 'invalid_credentials') {
        setError(t('delete.wrongPassword'));
      } else {
        const { key, params } = apiErrorMessage(e);
        setBanner({ variant: 'error', message: t(key, params) });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer
      scroll
      testID="screen-delete-account"
      footer={<Button testID="delete-confirm" variant="danger" label={t('delete.confirm')} onPress={() => void submit()} loading={loading} />}
    >
      <ScreenHeader title={t('delete.title')} fallbackHref="/settings" />
      <Banner variant="warning" message={t('delete.warning')} style={{ marginBottom: space[3] }} />
      {banner ? <Banner testID="delete-banner" variant={banner.variant} message={banner.message} style={{ marginBottom: space[3] }} /> : null}
      {graceDays !== null ? (
        <Text variant="body" tone="textMuted" testID="delete-grace">
          {t('delete.grace', { days: graceDays })}
        </Text>
      ) : (
        <TextField
          testID="delete-password"
          label={t('delete.password')}
          helper={t('delete.passwordHelp')}
          value={password}
          onChangeText={setPassword}
          error={error}
          disabled={loading}
          secureTextEntry
          passwordToggleLabels={{ show: t('ui.password.show'), hide: t('ui.password.hide') }}
          autoCapitalize="none"
          autoComplete="current-password"
        />
      )}
    </ScreenContainer>
  );
}
