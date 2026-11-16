import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';
import { Banner, Button } from '../../ui';
import { focusNode } from '../../ui/a11y/focus';

type Props = {
  /** Phrase de conséquence (jamais le libellé du bouton). */
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Libellé du bouton de confirmation (défaut : « Confirmer »). */
  confirmLabel?: string;
  loading?: boolean;
  testID?: string;
  confirmTestID?: string;
};

/**
 * Panneau de confirmation d'une action sensible (fermer une session, retirer un consentement) : bandeau d'avertissement,
 * bouton dangereux, annulation. À l'apparition, le focus du lecteur d'écran se place sur le message (le bandeau
 * l'annonce aussi sur iOS). Présentation seule : la confirmation et l'annulation restent à l'appelant.
 */
export function ConfirmPanel({ message, onConfirm, onCancel, confirmLabel, loading = false, testID, confirmTestID }: Props) {
  const { t } = useI18n();
  const { space } = useTheme();
  const messageRef = useRef<React.ComponentRef<typeof View>>(null);

  useEffect(() => {
    focusNode(messageRef);
  }, []);

  return (
    <View testID={testID} style={{ gap: space[3], marginVertical: space[3] }}>
      <View ref={messageRef} accessible accessibilityLabel={message}>
        <Banner variant="warning" message={message} />
      </View>
      <Button testID={confirmTestID} variant="danger" label={confirmLabel ?? t('common.confirm')} onPress={onConfirm} loading={loading} />
      <Button variant="ghost" label={t('common.cancel')} onPress={onCancel} disabled={loading} />
    </View>
  );
}
