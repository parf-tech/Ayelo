import React, { useState } from 'react';
import { View } from 'react-native';
import { isApiError } from '../../api/errors';
import { useAuth } from '../../auth/AuthProvider';
import { availableOAuthProviders, type OAuthProof } from '../../auth/oauthProof';
import { useI18n } from '../../i18n';
import { apiErrorMessage } from '../../i18n/apiErrors';
import { useTheme } from '../../theme';
import { Banner, Button, ScreenContainer, Text, TextField } from '../../ui';
import { passwordToggleLabels } from '../common/passwordToggle';
import { ScreenHeader } from '../common/ScreenHeader';
import { ManageSubscription } from '../premium/ManageSubscription';
import { setDeletionNotice } from './deletionNotice';
import { SocialReauth } from './SocialReauth';

/**
 * S55 : suppression du compte avec ré-authentification (DELETE /me). Mot de passe pour un compte e-mail ;
 * pour un compte Google / Apple, le serveur exige un jeton frais du fournisseur (nonce neuf, voir SocialReauth) ; sans SDK branché dans cette version,
 * l'écran l'explique et renvoie vers le support.
 */
export function DeleteAccountScreen() {
  const { t } = useI18n();
  const { space, colors, radius } = useTheme();
  const { api, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [banner, setBanner] = useState<{ variant: 'error' | 'warning'; message: string } | undefined>();
  const [loading, setLoading] = useState(false);
  const [graceDays, setGraceDays] = useState<number | null>(null);
  const [social, setSocial] = useState(false);

  const submit = async (proof?: OAuthProof) => {
    setBanner(undefined);
    if (!proof && password === '') {
      setError(t('delete.passwordRequired'));
      return;
    }
    setError(undefined);
    setLoading(true);
    try {
      // Compte social : preuve neuve du fournisseur (jeton + nonce brut), jamais rejouée ; sinon le mot de passe.
      const result = await api.auth.deleteAccount(proof ?? { password });
      // Pas de déconnexion ici : l'utilisateur doit lire la confirmation (délai de grâce, annulation, abonnement).
      // Si une requête 401 le déconnecte avant, l'accueil réaffiche la confirmation (deletionNotice).
      setDeletionNotice({ days: result.purge_after_days });
      setGraceDays(result.purge_after_days);
    } catch (e) {
      if (isApiError(e) && e.isValidation && (e.fieldError('provider') || e.fieldError('id_token'))) {
        setSocial(true);
        setBanner(availableOAuthProviders().length === 0 ? { variant: 'warning', message: t('delete.social') } : undefined);
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

  // Rappel de l'abonnement sur une carte calme : supprimer le compte ne le résilie pas.
  const subscription = (
    <View
      testID="delete-subscription"
      style={{ gap: space[2], padding: space[4], borderRadius: radius.md, backgroundColor: colors.surface }}
    >
      <Text variant="bodySmall" tone="textMuted">
        {t('delete.subscription')}
      </Text>
      <ManageSubscription testID="delete-manage-subscription" variant="button" />
    </View>
  );

  if (graceDays !== null) {
    return (
      <ScreenContainer
        scroll
        testID="screen-delete-account"
        footer={<Button testID="delete-signout" label={t('delete.signOut')} onPress={() => void signOut()} />}
      >
        <ScreenHeader title={t('delete.title')} hideBack />
        <View style={{ gap: space[6] }}>
          <Banner testID="delete-banner" variant="success" message={t('delete.done')} />
          <View style={{ gap: space[2] }}>
            <Text variant="bodyStrong" testID="delete-grace">
              {t('delete.grace', { days: graceDays })}
            </Text>
            <Text variant="body" tone="textMuted" testID="delete-cancel-hint">
              {t('delete.cancelHint')}
            </Text>
          </View>
          {subscription}
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      scroll
      testID="screen-delete-account"
      footer={<Button testID="delete-confirm" variant="danger" label={t('delete.confirm')} onPress={() => void submit()} loading={loading} />}
    >
      <ScreenHeader title={t('delete.title')} fallbackHref="/settings" />
      {/* Trois groupes séparés par l'espace (32) : avertissement, abonnement, ré-authentification. */}
      <View style={{ gap: space[6] }}>
        <View style={{ gap: space[3] }}>
          <Banner variant="warning" message={t('delete.warning')} />
          {banner ? <Banner testID="delete-banner" variant={banner.variant} message={banner.message} /> : null}
        </View>
        {subscription}
        <View style={{ gap: space[4] }}>
          {social ? <SocialReauth testID="delete-reauth" disabled={loading} onProof={(proof) => submit(proof)} /> : null}
          <TextField
            testID="delete-password"
            label={t('delete.password')}
            helper={t('delete.passwordHelp')}
            value={password}
            onChangeText={setPassword}
            error={error}
            disabled={loading}
            secureTextEntry
            passwordToggleLabels={passwordToggleLabels(t)}
            autoCapitalize="none"
            autoComplete="current-password"
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
          />
        </View>
      </View>
    </ScreenContainer>
  );
}
