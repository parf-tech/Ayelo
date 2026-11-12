import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { isApiError } from '../../api/errors';
import type { PublicProfile, SwipeAction } from '../../api/types';
import { useAuth } from '../../auth/AuthProvider';
import { usePaginated } from '../../hooks/usePaginated';
import { useI18n } from '../../i18n';
import { apiErrorMessage } from '../../i18n/apiErrors';
import { useTheme } from '../../theme';
import { AsyncView, Banner, Button, EmptyState, IconButton, ScreenContainer, Skeleton, Text, useToast } from '../../ui';
import { useDiscoverFilters } from './DiscoverFiltersProvider';
import { SwipeCard } from './SwipeCard';
import { performSwipe, primaryPhotoUrl } from './swipe';

const PAGE_SIZE = 10;
const PREFETCH_THRESHOLD = 3;

type Gate = 'quota' | 'premium' | null;

/** S10 : pile de cartes (geste + boutons), avec états chargement, erreur, vide, quota et Premium requis. */
export function DiscoverScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { space } = useTheme();
  const toast = useToast();
  const { api } = useAuth();
  const { filters } = useDiscoverFilters();
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const [gate, setGate] = useState<Gate>(null);
  const busy = useRef(false);

  const filtersKey = JSON.stringify(filters);
  const paged = usePaginated<PublicProfile>(
    (cursor) => api.discovery.discover({ ...(filters ?? {}), cursor, limit: PAGE_SIZE }),
    (p) => p.user_id,
    [api, filtersKey],
  );

  useEffect(() => {
    // Nouveaux filtres : la pile repart de zéro.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRemoved(new Set());
    setGate(null);
  }, [filtersKey]);

  const deck = useMemo(() => paged.items.filter((p) => !removed.has(p.user_id)), [paged.items, removed]);
  const top = deck[0];
  const next = deck[1];

  const { hasMore, loadingMore, loadMore, status } = paged;
  useEffect(() => {
    // Préchargement : on demande la page suivante quand il reste peu de cartes.
    if (status === 'ready' && hasMore && !loadingMore && deck.length <= PREFETCH_THRESHOLD) void loadMore();
  }, [status, hasMore, loadingMore, deck.length, loadMore]);

  const remove = useCallback((id: string, gone: boolean) => {
    setRemoved((previous) => {
      const copy = new Set(previous);
      if (gone) copy.add(id);
      else copy.delete(id);
      return copy;
    });
  }, []);

  const act = useCallback(
    async (action: SwipeAction) => {
      const card = top;
      if (!card || busy.current) return;
      busy.current = true;
      setGate(null);
      remove(card.user_id, true);
      const outcome = await performSwipe(api, card.user_id, action);
      busy.current = false;
      switch (outcome.kind) {
        case 'ok':
          return;
        case 'matched':
          router.push({
            pathname: '/match',
            params: {
              name: card.display_name,
              photo: primaryPhotoUrl(card) ?? '',
              conversationId: outcome.conversationId ?? '',
            },
          } as never);
          return;
        case 'premium':
          remove(card.user_id, false);
          setGate('premium');
          return;
        case 'quota':
          remove(card.user_id, false);
          setGate('quota');
          return;
        default:
          remove(card.user_id, false);
          toast.show({ message: t('discover.swipeFailed'), variant: 'error' });
      }
    },
    [api, remove, router, t, toast, top],
  );

  const undo = async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const { target_id } = await api.discovery.undoSwipe();
      const profile = await api.profile.publicProfile(target_id);
      paged.setItems((previous) => [profile, ...previous.filter((p) => p.user_id !== profile.user_id)]);
      remove(target_id, false);
      setGate(null);
    } catch (error) {
      if (isApiError(error) && (error.status === 402 || error.code === 'premium_required')) setGate('premium');
      else {
        const { key, params } = apiErrorMessage(error);
        toast.show({ message: t(key, params), variant: 'error' });
      }
    } finally {
      busy.current = false;
    }
  };

  const openProfile = (id: string) => router.push(`/user/${id}` as never);
  // Signalement depuis la carte : une seule entrée, puis motif et confirmation sur l'écran de signalement.
  const reportProfile = (profile: PublicProfile) =>
    router.push({
      pathname: '/report',
      params: { reportedId: profile.user_id, name: profile.display_name, contextType: 'profile', contextId: profile.user_id },
    } as never);
  const filtersActive = filters !== null;
  const needsProfile = status === 'error' && isApiError(paged.error) && paged.error.status === 403;

  return (
    <ScreenContainer testID="screen-discover">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[2] }}>
        <Text variant="title" header>
          {t('discover.title')}
        </Text>
        <IconButton
          testID="discover-filters"
          icon="SlidersHorizontal"
          variant="tonal"
          accessibilityLabel={filtersActive ? `${t('discover.filters')}, ${t('filters.active')}` : t('discover.filters')}
          selected={filtersActive}
          badge={filtersActive ? { kind: 'dot' } : undefined}
          onPress={() => router.push('/filters' as never)}
        />
      </View>

      {gate ? (
        <Banner
          testID={`discover-gate-${gate}`}
          variant="warning"
          message={gate === 'quota' ? `${t('discover.quota.title')}. ${t('discover.quota.body')}` : `${t('discover.premiumGate.title')}. ${t('discover.premiumGate.body')}`}
          actionLabel={t('discover.premium.cta')}
          onAction={() => router.push('/premium' as never)}
          onDismiss={() => setGate(null)}
          dismissLabel={t('discover.dismiss')}
          style={{ marginBottom: space[2] }}
        />
      ) : null}

      {needsProfile ? (
        <EmptyState
          testID="discover-needs-profile"
          title={t('discover.needProfile')}
          actionLabel={t('tabs.profile')}
          onAction={() => router.push('/profile' as never)}
        />
      ) : (
        <AsyncView
          testID="discover"
          status={status}
          error={paged.error}
          onRetry={() => void paged.refresh()}
          empty={deck.length === 0 && !hasMore && !loadingMore}
          emptyTitle={t('discover.empty.title')}
          emptyDescription={t('discover.empty.body')}
          emptyActionLabel={t('discover.empty.widen')}
          onEmptyAction={() => router.push('/filters' as never)}
        >
          <View style={{ flex: 1 }}>
            <View style={{ flex: 1, marginBottom: space[3] }} testID="discover-deck">
              {next ? <SwipeCard key={next.user_id} profile={next} interactive={false} onSwipe={() => undefined} onOpen={() => undefined} /> : null}
              {top ? (
                <SwipeCard key={top.user_id} profile={top} interactive onSwipe={(a) => void act(a)} onOpen={() => openProfile(top.user_id)} onReport={() => reportProfile(top)} />
              ) : (
                <View accessible accessibilityLabel={t('common.loading')} style={{ flex: 1 }}>
                  <Skeleton variant="card" height={400} />
                </View>
              )}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space[5], paddingBottom: space[2] }}>
              <IconButton
                testID="swipe-dislike"
                icon="X"
                variant="tonal"
                size="lg"
                accessibilityLabel={t('discover.dislike')}
                disabled={!top}
                onPress={() => void act('dislike')}
                style={{ width: 56, height: 56, borderRadius: 28 }}
              />
              <IconButton
                testID="swipe-super"
                icon="Star"
                variant="tonal"
                size="lg"
                accessibilityLabel={t('discover.superLike')}
                disabled={!top}
                onPress={() => void act('super_like')}
                style={{ width: 56, height: 56, borderRadius: 28 }}
              />
              <IconButton
                testID="swipe-like"
                icon="Heart"
                variant="filled"
                size="lg"
                accessibilityLabel={t('discover.like')}
                disabled={!top}
                onPress={() => void act('like')}
                style={{ width: 68, height: 68, borderRadius: 34 }}
              />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Button testID="swipe-undo" variant="ghost" label={t('discover.undo')} onPress={() => void undo()} />
              <Button
                testID="swipe-report"
                variant="ghost"
                label={t('discover.report')}
                accessibilityLabel={top ? t('discover.reportAria', { name: top.display_name }) : t('discover.report')}
                disabled={!top}
                onPress={() => top && reportProfile(top)}
              />
            </View>
          </View>
        </AsyncView>
      )}
    </ScreenContainer>
  );
}
