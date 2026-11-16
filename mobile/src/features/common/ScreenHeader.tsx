import { useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';
import { Button, Text } from '../../ui';

type Props = { title: string; fallbackHref?: string; right?: React.ReactNode; hideBack?: boolean };

/** En-tête d'écran : retour (repli si la pile est vide), titre (rôle header) et action facultative à droite. */
export function ScreenHeader({ title, fallbackHref = '/discover', right, hideBack = false }: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const { space } = useTheme();
  return (
    <View style={{ marginBottom: space[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {hideBack ? (
          <View />
        ) : (
          <Button
            testID="back-button"
            variant="ghost"
            label={t('common.back')}
            style={{ marginLeft: -space[5] }}
            onPress={() => (router.canGoBack() ? router.back() : router.replace(fallbackHref as never))}
          />
        )}
        {right}
      </View>
      <Text variant="title" header>
        {title}
      </Text>
    </View>
  );
}
