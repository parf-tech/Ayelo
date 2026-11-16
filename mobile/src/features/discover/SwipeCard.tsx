/* eslint-disable react-hooks/refs -- les gestionnaires du PanResponder ne lisent les refs que lors d'un geste, jamais pendant le rendu */
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Image, PanResponder, View } from 'react-native';
import type { PublicProfile, SwipeAction } from '../../api/types';
import { useI18n } from '../../i18n';
import { borderWidth, useTheme } from '../../theme';
import { Icon, Text, useMotion } from '../../ui';
import { countryLabel } from '../onboarding/countries';
import { Scrim } from './Scrim';
import { decideSwipe, primaryPhotoUrl } from './swipe';

/** Distance de sortie de la carte (hors écran) et échelle de la carte du dessous. */
const FLY_OUT_DISTANCE = 700;
const NEXT_CARD_SCALE = 0.96;
/** Hauteur du fondu prune sur la carte : le texte (nom, lieu, intention) reste dans la zone où il dépasse 0,65 d'opacité. */
const SCRIM_HEIGHT = '75%';

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
  const { reduced, duration } = useMotion();
  const position = useRef(new Animated.ValueXY()).current;
  const callbacks = useRef({ onSwipe, onOpen });
  // « Réduire les animations » : pas de ressort ni de sortie animée, la carte part ou revient d'un coup.
  const motion = useRef({ reduced, flyOut: duration('base') });
  useEffect(() => {
    callbacks.current = { onSwipe, onOpen };
    motion.current = { reduced, flyOut: duration('base') };
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
            if (motion.current.reduced) position.setValue({ x: 0, y: 0 });
            else Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
            return;
          }
          const done = () => {
            callbacks.current.onSwipe(action);
            position.setValue({ x: 0, y: 0 });
          };
          if (motion.current.reduced) {
            done();
            return;
          }
          const target =
            action === 'super_like' ? { x: 0, y: -FLY_OUT_DISTANCE } : { x: action === 'like' ? FLY_OUT_DISTANCE : -FLY_OUT_DISTANCE, y: g.dy };
          Animated.timing(position, { toValue: target, duration: motion.current.flyOut, useNativeDriver: false }).start(done);
        },
      }),
    [interactive, position],
  );

  const rotate = position.x.interpolate({ inputRange: [-200, 0, 200], outputRange: ['-8deg', '0deg', '8deg'] });
  const photo = primaryPhotoUrl(profile);
  const base = profile.city
    ? t('discover.card', { name: profile.display_name, age: profile.age, city: profile.city })
    : t('discover.cardNoCity', { name: profile.display_name, age: profile.age });
  // Le nom, le profil vérifié et l'intention se lisent ensemble ; la consigne de geste est dans accessibilityHint.
  const label = [base, profile.verified ? t('discover.verified') : null, t(`intent.${profile.intent}.label`)].filter(Boolean).join('. ');

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
        borderWidth: borderWidth.hairline,
        borderColor: colors.border,
        backgroundColor: colors.brand,
        transform: interactive ? [{ translateX: position.x }, { translateY: position.y }, { rotate }] : [{ scale: NEXT_CARD_SCALE }],
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
      <Scrim height={SCRIM_HEIGHT} testID={interactive ? 'swipe-card-scrim' : undefined} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: space[5], gap: space[1] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], flexWrap: 'wrap' }}>
          <Text variant="title" numberOfLines={1} tone="onBrand" style={{ flexShrink: 1 }}>
            {profile.display_name}, {profile.age}
          </Text>
          {profile.verified ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
              <Icon name="BadgeCheck" size="sm" tone="onBrand" />
              <Text variant="captionStrong" tone="onBrand">
                {t('discover.verified')}
              </Text>
            </View>
          ) : null}
        </View>
        <Text variant="body" numberOfLines={1} tone="onBrand">
          {[profile.city, countryLabel(t, profile.residence_country)].filter(Boolean).join(', ')}
        </Text>
        <View
          style={{
            alignSelf: 'flex-start',
            marginTop: space[2],
            paddingHorizontal: space[3],
            paddingVertical: space[1],
            borderRadius: radius.pill,
            borderWidth: borderWidth.hairline,
            borderColor: colors.onBrand,
          }}
        >
          <Text variant="captionStrong" tone="onBrand">
            {t(`intent.${profile.intent}.label`)}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}
