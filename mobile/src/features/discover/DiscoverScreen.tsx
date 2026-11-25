import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { isApiError } from '../../api/errors';
import type { PublicProfile, SwipeAction } from '../../api/types';
import { useAuth } from '../../auth/AuthProvider';
import { usePaginated } from '../../hooks/usePaginated';
import { useI18n } from '../../i18n';
import { apiErrorMessage } from '../../i18n/apiErrors';
import { useTheme } from '../../theme';
import { AsyncView, Banner, Button, EmptyState, IconButton, ScreenContainer, Skeleton, Text, useToast } from '../../ui';
import { footerScrolls } from '../../ui/ScreenContainer';
import { SwipeActions } from './SwipeActions';
import { useDiscoverFilters } from './DiscoverFiltersProvider';
import { SwipeCard } from './SwipeCard';
import { performSwipe, primaryPhotoUrl } from './swipe';

const PAGE_SIZE = 10;
const PREFETCH_THRESHOLD = 3;
/** Hauteur minimale du squelette de carte (il occupe sinon tout l'espace libre au-dessus des boutons). */
const CARD_SKELETON_MIN_HEIGHT = 240;
/**
 * Hauteur minimale de la pile : avec une bannière (quota, Premium requis) sur un écran court, la pile n'est plus écrasée
 * à quelques points (nom et pastille masqués). Le geste (PanResponder) interdit d'envelopper l'écran dans un défilement.
 */
const DECK_MIN_HEIGHT = 200;

type Pending = SwipeAction | 'undo' | null;

type Gate = 'quota' | 'premium' | null;

/** Squelette en forme de carte : il prend la place de la pile (même rayon) au lieu de quatre barres de liste. */
function CardSkeleton() {
  return <Skeleton variant="card" style={{ flex: 1, height: undefined, minHeight: CARD_SKELETON_MIN_HEIGHT }} />;
}

/** S10 : pile de cartes (geste + boutons), avec états chargement, erreur, vide, quota et Premium requis. */
export function DiscoverScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { space } = useTheme();
  const { height, fontScale } = useWindowDimensions();
  const toast = useToast();
  const { api } = useAuth();
  const { filters } = useDiscoverFilters();
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const [gate, setGate] = useState<Gate>(null);
  const busy = useRef(false);
  // Envoi en cours (visible : le bouton concerné montre l'attente) et dernière carte notée pendant cette séance (Annuler).
  const [pending, setPending] = useState<Pending>(null);

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
      setPending(action);
      setGate(null);
      remove(card.user_id, true);
      const outcome = await performSwipe(api, card.user_id, action);
      busy.current = false;
      setPending(null);
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
    setPending('undo');
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
      setPending(null);
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
  const forbidden = status === 'error' && isApiError(paged.error) && paged.error.status === 403 ? paged.error : null;
  // Compte suspendu ou banni (revue N-02) : on mène à la sanction et à la contestation, pas au profil.
  const restricted = forbidden?.code === 'account_restricted';
  const needsProfile = forbidden !== null && !restricted;

  return (
    <ScreenContainer testID="screen-discover">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[2] }}>
        <Text variant="title" header style={{ flexShrink: 1 }}>
          {t('discover.title')}
        </Text>
        <IconButton
          testID="discover-filters"
          icon="SlidersHorizontal"
          variant="tonal"
          accessibilityLabel={t('discover.filters')}
          selected={filtersActive}
          badge={filtersActive ? { kind: 'dot', accessibilityLabel: t('filters.active') } : undefined}
          onPress={() => router.push('/filters' as never)}
        />
      </View>

      {gate ? (
        <Banner
          testID={`discover-gate-${gate}`}
          variant={gate === 'quota' ? 'warning' : 'info'}
          message={gate === 'quota' ? `${t('discover.quota.title')}. ${t('discover.quota.body')}` : t('discover.premiumGate.title')}
          actionLabel={t('discover.premium.cta')}
          onAction={() => router.push('/premium' as never)}
          onDismiss={() => setGate(null)}
          dismissLabel={t('discover.dismiss')}
          style={{ marginBottom: space[2] }}
        />
      ) : null}

      {restricted ? (
        <EmptyState
          testID="discover-restricted"
          title={t('discover.restricted')}
          actionLabel={t('settings.sanctions')}
          onAction={() => router.push('/settings/sanctions' as never)}
        />
      ) : needsProfile ? (
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
          emptyIcon="Search"
          loadingSkeleton={<CardSkeleton />}
        >
          <View style={{ flex: 1 }}>
            <View style={{ flex: 1, minHeight: DECK_MIN_HEIGHT, marginBottom: space[3] }} testID="discover-deck">
              {next ? <SwipeCard key={next.user_id} profile={next} interactive={false} onSwipe={() => undefined} onOpen={() => undefined} /> : null}
              {top ? (
                <SwipeCard key={top.user_id} profile={top} interactive onSwipe={(a) => void act(a)} onOpen={() => openProfile(top.user_id)} onReport={() => reportProfile(top)} />
              ) : (
                <View accessible accessibilityLabel={t('common.loading')} style={{ flex: 1 }}>
                  <CardSkeleton />
                </View>
              )}
            </View>
            <View style={{ paddingBottom: space[2] }}>
              <SwipeActions idPrefix="swipe" disabled={!top} pending={pending === 'undo' ? null : pending} onAction={(a) => void act(a)} />
            </View>
            {/* Les deux boutons rétrécissent et passent à la ligne : aucun n'est poussé hors de l'écran (320 pt, texte agrandi).
                Écran court ou texte agrandi avec une bannière : la rangée s'efface pour laisser sa place à la pile (retour dès que la bannière est fermée). */}
            {gate && footerScrolls(height, fontScale) ? null : (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[2] }}>
              <Button
                testID="swipe-undo"
                variant="ghost"
                style={{ flexShrink: 1 }}
                label={t('discover.undo')}
                onPress={() => void undo()}
                disabled={pending !== null}
                loading={pending === 'undo'}
              />
              <Button
                testID="swipe-report"
                variant="ghost"
                style={{ flexShrink: 1 }}
                label={t('discover.report')}
                accessibilityLabel={top ? t('discover.reportAria', { name: top.display_name }) : t('discover.report')}
                disabled={!top}
                onPress={() => top && reportProfile(top)}
              />
            </View>
            )}
          </View>
        </AsyncView>
      )}
    </ScreenContainer>
  );
}
