import React from 'react';
import { View } from 'react-native';
import { useI18n } from '../../i18n';
import { IconButton } from '../../ui';
import { useGoBack } from './useGoBack';

/** Retour (geste système et bouton Android fonctionnent aussi). Repli sur `fallbackHref` si la pile est vide. */
export function BackButton({ fallbackHref = '/' }: { fallbackHref?: string }) {
  const { t } = useI18n();
  const goBack = useGoBack(fallbackHref);
  return (
    <View style={{ alignSelf: 'flex-start' }}>
      <IconButton testID="back-button" icon="ChevronLeft" accessibilityLabel={t('common.back')} onPress={goBack} />
    </View>
  );
}
