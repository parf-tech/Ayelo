import { useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { useI18n } from '../../i18n';
import { Button } from '../../ui';

/** Retour (geste système et bouton Android fonctionnent aussi). Repli sur l'accueil si la pile est vide. */
export function BackButton({ fallbackHref = '/' }: { fallbackHref?: string }) {
  const router = useRouter();
  const { t } = useI18n();
  return (
    <View style={{ alignSelf: 'flex-start' }}>
      <Button
        testID="back-button"
        variant="ghost"
        label={t('common.back')}
        onPress={() => (router.canGoBack() ? router.back() : router.replace(fallbackHref as never))}
      />
    </View>
  );
}
