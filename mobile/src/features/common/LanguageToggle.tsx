import React from 'react';
import { View } from 'react-native';
import { useI18n } from '../../i18n';
import { Button } from '../../ui';

/** Bascule fr/en : la langue du téléphone est le point de départ, le choix de l'utilisateur prime ensuite. */
export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();
  const other = locale === 'fr' ? 'en' : 'fr';
  return (
    <View style={{ alignSelf: 'flex-end' }}>
      <Button
        testID="language-toggle"
        variant="ghost"
        label={t(`language.name.${other}`)}
        accessibilityLabel={`${t('language.change')}: ${t(`language.name.${other}`)}`}
        onPress={() => setLocale(other)}
      />
    </View>
  );
}
