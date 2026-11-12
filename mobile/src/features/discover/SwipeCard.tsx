/* eslint-disable react-hooks/refs -- les gestionnaires du PanResponder ne lisent les refs que lors d'un geste, jamais pendant le rendu */
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Image, PanResponder, View } from 'react-native';
import type { PublicProfile, SwipeAction } from '../../api/types';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';
import { Text } from '../../ui';
import { countryLabel } from '../onboarding/countries';
import { Scrim } from './Scrim';
import { decideSwipe, primaryPhotoUrl } from './swipe';

type Props = {
  profile: PublicProfile;
  /** Carte du dessus : seule celle-ci réagit au geste. */
  interactive: boolean;
  onSwipe: (action: SwipeAction) => void;
  onOpen: () => void;
  /** Signalement (une seule entrée depuis la carte) ; absent sur la carte du dessous. */
  onReport?: () => void;
};

/**
 * Carte de profil. Geste : glisser à droite = like, à gauche = dislike, vers le haut = coup de cœur.
 * Équivalent accessible : actions d'accessibilité de la carte + boutons de l'écran (DiscoverScreen).
 */
export function SwipeCard({ profile, interactive, onSwipe, onOpen, onReport }: Props) {
  const { t } = useI18n();
  const { colors, radius, space } = useTheme();
  const position = useRef(new Animated.ValueXY()).current;
  const callbacks = useRef({ onSwipe, onOpen });
  useEffect(() => {
    callbacks.current = { onSwipe, onOpen };
  });

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => interactive,
        onMoveShouldSetPanResponder: (_e, g) => interactive && (Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6),
        onPanResponderMove: Animated.event([null, { dx: position.x, dy: position.y }], { useNativeDriver: false }),
        onPanResponderRelease: (_e, g) => {
          if (Math.abs(g.dx) < 6 && Math.abs(g.dy) < 6) {
            callbacks.current.onOpen();
            return;
          }
          const action = decideSwipe(g.dx, g.dy);
          if (!action) {
            Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
            return;
          }
          const target = action === 'super_like' ? { x: 0, y: -700 } : { x: action === 'like' ? 700 : -700, y: g.dy };
          Animated.timing(position, { toValue: target, duration: 180, useNativeDriver: false }).start(() => {
            callbacks.current.onSwipe(action);
            position.setValue({ x: 0, y: 0 });
          });
        },
      }),
    [interactive, position],
  );

  const rotate = position.x.interpolate({ inputRange: [-200, 0, 200], outputRange: ['-8deg', '0deg', '8deg'] });
  const photo = primaryPhotoUrl(profile);
  const label = profile.city
    ? t('discover.card', { name: profile.display_name, age: profile.age, city: profile.city })
    : t('discover.cardNoCity', { name: profile.display_name, age: profile.age });

  return (
    <Animated.View
      testID={interactive ? 'swipe-card' : 'swipe-card-next'}
      {...(interactive ? panResponder.panHandlers : {})}
      accessible={interactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={t('discover.swipeHint')}
      accessibilityActions={
        interactive
          ? [
              { name: 'activate', label: t('discover.openProfile', { name: profile.display_name }) },
              { name: 'like', label: t('discover.like') },
              { name: 'dislike', label: t('discover.dislike') },
              { name: 'super_like', label: t('discover.superLike') },
              ...(onReport ? [{ name: 'report', label: t('discover.reportAria', { name: profile.display_name }) }] : []),
            ]
          : undefined
      }
      onAccessibilityAction={(event) => {
        const name = event.nativeEvent.actionName;
        if (name === 'activate') onOpen();
        else if (name === 'report') onReport?.();
        else if (name === 'like' || name === 'dislike' || name === 'super_like') onSwipe(name);
      }}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: radius.lg,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.brand,
        transform: interactive ? [{ translateX: position.x }, { translateY: position.y }, { rotate }] : [{ scale: 0.96 }],
      }}
    >
      {photo ? (
        <Image
          source={{ uri: photo }}
          accessibilityIgnoresInvertColors
          accessible={false}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.skeleton }}
        />
      ) : (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.skeleton }}>
          <Text variant="body" tone="textMuted">
            {t('discover.noPhoto')}
          </Text>
        </View>
      )}
      <Scrim height="62%" testID={interactive ? 'swipe-card-scrim' : undefined} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: space[5], gap: space[1] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], flexWrap: 'wrap' }}>
          <Text variant="title" numberOfLines={1} style={{ flexShrink: 1, color: colors.onBrand }}>
            {profile.display_name}, {profile.age}
          </Text>
          {profile.verified ? (
            <Text variant="captionStrong" style={{ color: colors.onBrand }}>
              ✓ {t('discover.verified')}
            </Text>
          ) : null}
        </View>
        <Text variant="body" numberOfLines={1} style={{ color: colors.onBrand }}>
          {[profile.city, countryLabel(t, profile.residence_country)].filter(Boolean).join(', ')}
        </Text>
        <View
          style={{
            alignSelf: 'flex-start',
            marginTop: space[2],
            paddingHorizontal: space[3],
            paddingVertical: space[1],
            borderRadius: radius.pill,
            borderWidth: 1,
            borderColor: colors.onBrand,
          }}
        >
          <Text variant="captionStrong" style={{ color: colors.onBrand }}>
            {t(`intent.${profile.intent}.label`)}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}
