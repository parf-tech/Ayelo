import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { useI18n } from '../../i18n';
import { borderWidth, MIN_TARGET, useTheme } from '../../theme';
import { announce, Avatar, Button, Icon, ScreenContainer, Text } from '../../ui';
import { useGoBack } from '../common/useGoBack';
import { primaryPhotoUrl } from './swipe';

/**
 * Diamètre des photos : deux photos côte à côte, ou une seule un peu plus grande. L'anneau est un cercle (rayon pill) quel que
 * soit le diamètre : un rayon fixe (60) ne l'était pas à 140.
 */
const AVATAR_PAIR = 112;
const AVATAR_SOLO = 140;
/** Pastille cœur : une cible de la taille minimale tactile. */
const HEART_BADGE_SIZE = MIN_TARGET;

/** S12 : célébration du match. « Écrire » ouvre la conversation, « Continuer » revient à la découverte. */
export function MatchScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { colors, radius, space } = useTheme();
  const goBack = useGoBack('/discover');
  const { state } = useAuth();
  // Ma photo : données réelles du profil connecté ; absente, seule la photo de l'autre personne est montrée.
  const myPhoto = state.user?.profile ? primaryPhotoUrl(state.user.profile) : null;
  const myName = state.user?.profile?.display_name ?? '';
  const params = useLocalSearchParams<{ name?: string; photo?: string; conversationId?: string }>();
  const name = typeof params.name === 'string' && params.name ? params.name : '';
  const photo = typeof params.photo === 'string' && params.photo ? params.photo : null;
  const conversationId = typeof params.conversationId === 'string' && params.conversationId ? params.conversationId : null;

  // Écran ouvert par une action (like), sans changement de titre de navigation : on l'annonce explicitement (iOS n'a pas de région vive).
  useEffect(() => {
    announce(name ? `${t('match.title')} ${t('match.body', { name })}` : t('match.title'));
  }, [name, t]);

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
            onPress={goBack}
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
            <View style={{ borderRadius: radius.pill, borderWidth: borderWidth.strong, borderColor: colors.onBrand }}>
              <Avatar uri={myPhoto} name={myName || '?'} size={AVATAR_PAIR} testID="match-avatar-self" />
            </View>
          ) : null}
          <View
            style={{
              borderRadius: radius.pill,
              borderWidth: borderWidth.strong,
              borderColor: colors.onBrand,
              marginLeft: myPhoto ? -space[4] : 0,
            }}
          >
            <Avatar uri={photo} name={name || '?'} size={myPhoto ? AVATAR_PAIR : AVATAR_SOLO} testID="match-avatar" />
          </View>
        </View>
        <View
          accessible={false}
          style={{ width: HEART_BADGE_SIZE, height: HEART_BADGE_SIZE, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary }}
        >
          <Icon name="Heart" size="md" tone="onPrimary" filled />
        </View>
        <Text variant="title" header align="center" tone="onBrand" accessibilityLiveRegion="polite">
          {t('match.title')}
        </Text>
        {name ? (
          <Text variant="body" align="center" tone="onBrand">
            {t('match.body', { name })}
          </Text>
        ) : null}
      </View>
    </ScreenContainer>
  );
}
