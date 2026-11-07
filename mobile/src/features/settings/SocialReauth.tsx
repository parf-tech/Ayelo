import React, { useState } from 'react';
import { View } from 'react-native';
import type { OAuthProvider } from '../../api/types';
import { availableOAuthProviders, obtainOAuthProof, type OAuthProof } from '../../auth/oauthProof';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';
import { Banner, Button } from '../../ui';

type Props = {
  /** Reçoit une preuve NEUVE (jeton + nonce) à chaque appui ; jamais conservée ici. */
  onProof: (proof: OAuthProof) => Promise<void>;
  disabled?: boolean;
  testID: string;
};

/**
 * Ré-authentification d'un compte Google / Apple (suppression, export) : un bouton par fournisseur branché.
 * Chaque appui redemande au fournisseur un jeton neuf avec un nonce neuf (revue P-06). Rien si aucun SDK n'est branché.
 */
export function SocialReauth({ onProof, disabled, testID }: Props) {
  const { t } = useI18n();
  const { space } = useTheme();
  const [busy, setBusy] = useState<OAuthProvider | null>(null);
  const [failed, setFailed] = useState(false);
  const providers = availableOAuthProviders();
  if (providers.length === 0) return null;

  const run = async (provider: OAuthProvider) => {
    setFailed(false);
    setBusy(provider);
    try {
      await onProof(await obtainOAuthProof(provider));
    } catch {
      // Annulation par l'utilisateur ou échec du SDK : message générique, aucun détail du fournisseur.
      setFailed(true);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View testID={testID} style={{ gap: space[2], marginBottom: space[3] }}>
      {failed ? <Banner testID={`${testID}-error`} variant="warning" message={t('reauth.failed')} /> : null}
      {providers.map((provider) => (
        <Button
          key={provider}
          testID={`${testID}-${provider}`}
          variant="secondary"
          label={t(provider === 'google' ? 'reauth.google' : 'reauth.apple')}
          onPress={() => void run(provider)}
          loading={busy === provider}
          disabled={disabled || busy !== null}
        />
      ))}
    </View>
  );
}
