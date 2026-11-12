import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';
import { Avatar, Button, Icon, ScreenContainer, Text } from '../../ui';
import { primaryPhotoUrl } from './swipe';

/** S12 : célébration du match. « Écrire » ouvre la conversation, « Continuer » revient à la découverte. */
export function MatchScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { colors, radius, space } = useTheme();
  const { state } = useAuth();
  // Ma photo : données réelles du profil connecté ; absente, seule la photo de l'autre personne est montrée.
  const myPhoto = state.user?.profile ? primaryPhotoUrl(state.user.profile) : null;
  const myName = state.user?.profile?.display_name ?? '';
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
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: space[4],
          padding: space[5],
          marginBottom: space[3],
          borderRadius: radius.lg,
          backgroundColor: colors.brand,
        }}
      >
        <View accessible={false} style={{ flexDirection: 'row', alignItems: 'center' }}>
          {myPhoto ? (
            <View style={{ borderRadius: 60, borderWidth: 3, borderColor: colors.onBrand }}>
              <Avatar uri={myPhoto} name={myName || '?'} size={112} testID="match-avatar-self" />
            </View>
          ) : null}
          <View
            style={{
              borderRadius: 60,
              borderWidth: 3,
              borderColor: colors.onBrand,
              marginLeft: myPhoto ? -space[4] : 0,
            }}
          >
            <Avatar uri={photo} name={name || '?'} size={myPhoto ? 112 : 140} testID="match-avatar" />
          </View>
        </View>
        <View
          accessible={false}
          style={{ width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary }}
        >
          <Icon name="Heart" size="md" tone="onPrimary" filled />
        </View>
        <Text variant="title" header align="center" style={{ color: colors.onBrand }}>
          {t('match.title')}
        </Text>
        {name ? (
          <Text variant="body" align="center" style={{ color: colors.onBrand }}>
            {t('match.body', { name })}
          </Text>
        ) : null}
      </View>
    </ScreenContainer>
  );
}
