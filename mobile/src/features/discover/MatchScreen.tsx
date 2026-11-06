import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';
import { Avatar, Button, ScreenContainer, Text } from '../../ui';

/** S12 : célébration du match. « Écrire » ouvre la conversation, « Continuer » revient à la découverte. */
export function MatchScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { space } = useTheme();
  const params = useLocalSearchParams<{ name?: string; photo?: string; conversationId?: string }>();
  const name = typeof params.name === 'string' && params.name ? params.name : '';
  const photo = typeof params.photo === 'string' && params.photo ? params.photo : null;
  const conversationId = typeof params.conversationId === 'string' && params.conversationId ? params.conversationId : null;

  return (
    <ScreenContainer
      testID="screen-match"
      footer={
        <View style={{ gap: space[2] }}>
          {conversationId ? (
            <Button
              testID="match-write"
              label={t('match.write')}
              onPress={() => router.replace({ pathname: '/conversation/[id]', params: { id: conversationId, name, photo: photo ?? '' } } as never)}
            />
          ) : null}
          <Button
            testID="match-continue"
            variant={conversationId ? 'secondary' : 'primary'}
            label={t('match.continue')}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/discover' as never))}
          />
        </View>
      }
    >
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[4] }}>
        <Avatar uri={photo} name={name || '?'} size={140} testID="match-avatar" />
        <Text variant="title" tone="primary" header align="center">
          {t('match.title')}
        </Text>
        {name ? (
          <Text variant="body" tone="textMuted" align="center">
            {t('match.body', { name })}
          </Text>
        ) : null}
      </View>
    </ScreenContainer>
  );
}
