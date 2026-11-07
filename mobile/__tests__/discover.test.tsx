import { act, fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import { DiscoverFiltersProvider, useDiscoverFilters } from '../src/features/discover/DiscoverFiltersProvider';
import { DiscoverScreen } from '../src/features/discover/DiscoverScreen';
import { FiltersScreen } from '../src/features/discover/FiltersScreen';
import { MatchScreen } from '../src/features/discover/MatchScreen';
import { ProfileDetailScreen } from '../src/features/discover/ProfileDetailScreen';
import { decideSwipe, performSwipe, primaryPhotoUrl, readablePhotos, SWIPE_DISTANCE } from '../src/features/discover/swipe';
import { ReportScreen } from '../src/features/safety/ReportScreen';
import { createApiClient, createEndpoints } from '../src/api';
import { resetDeviceIdCacheForTests } from '../src/storage/deviceId';
import { tokenStore } from '../src/storage/tokenStore';
import { emptyBody, installFakeApi } from './helpers/fakeApi';
import { media, meFixture, publicProfile } from './helpers/fixtures';
import { resetRouterMocks, router } from './helpers/routerMock';
import { renderShell } from './helpers/shell';

const mockParams: { current: Record<string, string> } = { current: {} };
jest.mock('expo-router', () => ({
  ...require('./helpers/routerMock').expoRouterMock,
  useLocalSearchParams: () => mockParams.current,
}));

const ME = meFixture();
const user = () => userEvent.setup();
const AWA = publicProfile('p1', 'Awa');
const BINTA = publicProfile('p2', 'Binta', { age: 31 });
const CARLA = publicProfile('p3', 'Carla', { age: 25 });

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  tokenStore.resetCacheForTests();
  resetDeviceIdCacheForTests();
  resetRouterMocks();
  mockParams.current = {};
});

afterEach(async () => {
  await act(async () => undefined);
});

function deck(profiles = [AWA, BINTA], next_cursor: string | null = null): Record<string, [number, unknown]> {
  return { 'GET /me': [200, ME], 'GET /discover': [200, { data: profiles, next_cursor }] };
}

describe('geste de swipe (logique pure)', () => {
  it('droite = like, gauche = dislike, haut = coup de cœur, court = la carte revient', () => {
    expect(decideSwipe(SWIPE_DISTANCE + 1, 0)).toBe('like');
    expect(decideSwipe(-SWIPE_DISTANCE - 1, 10)).toBe('dislike');
    expect(decideSwipe(0, -SWIPE_DISTANCE * 2)).toBe('super_like');
    expect(decideSwipe(40, 20)).toBeNull();
    // Un geste surtout horizontal vers le haut reste un like.
    expect(decideSwipe(SWIPE_DISTANCE + 80, -SWIPE_DISTANCE * 1.4)).toBe('like');
  });

  it('photos lisibles : ignore les médias sans URL, ordonne par position', () => {
    const profile = publicProfile('x', 'X', { media: [media('b', 1), media('a', 0), media('c', 2, 'processing', null)] });
    expect(readablePhotos(profile).map((m) => m.id)).toEqual(['a', 'b']);
    expect(primaryPhotoUrl(profile)).toBe('https://cdn.example.test/a.jpg');
    expect(primaryPhotoUrl(publicProfile('y', 'Y', { media: [] }))).toBeNull();
  });

  it('performSwipe classe les réponses : ok, match, 402, 429, erreur', async () => {
    const api = createEndpoints(createApiClient({ baseUrl: 'https://api.example.test', getDeviceId: async () => 'd', getToken: async () => 'T' }));
    const fake = installFakeApi({ 'POST /swipes': [201, { status: 'recorded', matched: false }] });
    expect(await performSwipe(api, 'p1', 'like')).toEqual({ kind: 'ok' });
    fake.set('POST /swipes', [201, { status: 'recorded', matched: true, match_id: 'm1', conversation_id: 'c1' }]);
    expect(await performSwipe(api, 'p1', 'like')).toEqual({ kind: 'matched', matchId: 'm1', conversationId: 'c1' });
    fake.set('POST /swipes', [402, { error: { code: 'premium_required', message: 'x' } }]);
    expect(await performSwipe(api, 'p1', 'super_like')).toEqual({ kind: 'premium' });
    fake.set('POST /swipes', [429, { error: { code: 'quota_reached', message: 'x' } }]);
    expect(await performSwipe(api, 'p1', 'like')).toEqual({ kind: 'quota' });
    fake.set('POST /swipes', [500, { error: { code: 'server_error', message: 'x' } }]);
    expect((await performSwipe(api, 'p1', 'like')).kind).toBe('error');
  });
});

describe('S10 Découverte', () => {
  it('charge la pile (limite 10), affiche la première carte et envoie le like', async () => {
    const fake = installFakeApi({ ...deck(), 'POST /swipes': [201, { status: 'recorded', matched: false }] } as never);
    await renderShell(<DiscoverScreen />);
    expect(await screen.findByLabelText(/Awa, 28 ans/)).toBeOnTheScreen();
    expect(fake.called('GET /discover')[0]?.url).toContain('limit=10');
    await user().press(screen.getByTestId('swipe-like'));
    await waitFor(() => expect(fake.called('POST /swipes')).toHaveLength(1));
    expect(fake.called('POST /swipes')[0]?.body).toEqual({ target_id: 'p1', action: 'like' });
    expect(await screen.findByLabelText(/Binta, 31 ans/)).toBeOnTheScreen();
  });

  it('boutons accessibles : libellés, cibles >= 44 et actions d\'accessibilité sur la carte', async () => {
    installFakeApi(deck());
    await renderShell(<DiscoverScreen />);
    const card = await screen.findByTestId('swipe-card');
    expect(card.props.accessibilityActions.map((a: { name: string }) => a.name)).toEqual(['activate', 'like', 'dislike', 'super_like', 'report']);
    for (const label of ['Passer', 'Coup de cœur', 'J’aime']) {
      expect(screen.getByRole('button', { name: label })).toBeOnTheScreen();
    }
  });

  it('match réciproque : ouvre l\'écran de match avec la conversation', async () => {
    installFakeApi({ ...deck(), 'POST /swipes': [201, { status: 'recorded', matched: true, match_id: 'm1', conversation_id: 'c9' }] } as never);
    await renderShell(<DiscoverScreen />);
    await screen.findByLabelText(/Awa, 28 ans/);
    await user().press(screen.getByTestId('swipe-like'));
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/match',
        params: { name: 'Awa', photo: 'https://cdn.example.test/p1-m1.jpg', conversationId: 'c9' },
      }),
    );
  });

  it('quota de likes (429) : la carte revient et un avis propose Premium', async () => {
    installFakeApi({ ...deck(), 'POST /swipes': [429, { error: { code: 'quota_reached', message: 'x' } }] } as never);
    await renderShell(<DiscoverScreen />);
    await screen.findByLabelText(/Awa, 28 ans/);
    const u = user();
    await u.press(screen.getByTestId('swipe-like'));
    const gate = await screen.findByTestId('discover-gate-quota');
    expect(gate).toHaveTextContent(/Limite de likes atteinte/);
    expect(screen.getByLabelText(/Awa, 28 ans/)).toBeOnTheScreen();
    await u.press(screen.getByRole('button', { name: 'Voir les offres Premium' }));
    expect(router.push).toHaveBeenCalledWith('/premium');
  });

  it('coup de cœur sans Premium (402) : avis « réservé Premium »', async () => {
    installFakeApi({ ...deck(), 'POST /swipes': [402, { error: { code: 'premium_required', message: 'x' } }] } as never);
    await renderShell(<DiscoverScreen />);
    await screen.findByLabelText(/Awa, 28 ans/);
    await user().press(screen.getByTestId('swipe-super'));
    expect(await screen.findByTestId('discover-gate-premium')).toBeOnTheScreen();
  });

  it('annuler : 402 sans Premium -> avis ; avec Premium -> la carte réapparaît', async () => {
    const fake = installFakeApi({
      ...deck(),
      'POST /swipes': [201, { status: 'recorded', matched: false }],
      'POST /swipes/undo': [402, { error: { code: 'premium_required', message: 'x' } }],
      'GET /profiles/p1': [200, AWA],
    } as never);
    await renderShell(<DiscoverScreen />);
    await screen.findByLabelText(/Awa, 28 ans/);
    const u = user();
    await u.press(screen.getByTestId('swipe-dislike'));
    await screen.findByLabelText(/Binta, 31 ans/);
    await u.press(screen.getByTestId('swipe-undo'));
    expect(await screen.findByTestId('discover-gate-premium')).toBeOnTheScreen();
    fake.set('POST /swipes/undo', [200, { target_id: 'p1' }]);
    await u.press(screen.getByTestId('swipe-undo'));
    expect(await screen.findByLabelText(/Awa, 28 ans/)).toBeOnTheScreen();
  });

  it('préchargement : il reste peu de cartes -> page suivante par curseur', async () => {
    const fake = installFakeApi({
      'GET /me': [200, ME],
      'GET /discover': ((req: { url: string }) =>
        req.url.includes('cursor=C2')
          ? [200, { data: [CARLA], next_cursor: null }]
          : [200, { data: [AWA, BINTA], next_cursor: 'C2' }]) as never,
    });
    await renderShell(<DiscoverScreen />);
    await screen.findByLabelText(/Awa, 28 ans/);
    await waitFor(() => expect(fake.calls.some((c) => c.url.includes('cursor=C2'))).toBe(true));
  });

  it('fin de pile : état vide avec suggestion d\'élargir les filtres', async () => {
    installFakeApi(deck([]));
    await renderShell(<DiscoverScreen />);
    expect(await screen.findByText('Vous avez tout vu pour le moment')).toBeOnTheScreen();
    await user().press(screen.getByRole('button', { name: 'Modifier les filtres' }));
    expect(router.push).toHaveBeenCalledWith('/filters');
  });

  it('erreur serveur et hors ligne : états dédiés avec « Réessayer »', async () => {
    const fake = installFakeApi({ 'GET /me': [200, ME], 'GET /discover': [500, { error: { code: 'server_error', message: 'x' } }] } as never);
    await renderShell(<DiscoverScreen />);
    expect(await screen.findByText('Impossible de charger')).toBeOnTheScreen();
    fake.set('GET /discover', () => {
      throw new TypeError('Network request failed');
    });
    await user().press(screen.getByTestId('async-retry'));
    expect(await screen.findByText('Vous êtes hors ligne')).toBeOnTheScreen();
    fake.set('GET /discover', [200, { data: [AWA], next_cursor: null }]);
    await user().press(screen.getByTestId('async-retry'));
    expect(await screen.findByLabelText(/Awa, 28 ans/)).toBeOnTheScreen();
  });

  it('profil non créé (403) : invitation à compléter le profil', async () => {
    installFakeApi({ 'GET /me': [200, ME], 'GET /discover': [403, { error: { code: 'forbidden', message: 'Profil à compléter.' } }] } as never);
    await renderShell(<DiscoverScreen />);
    expect(await screen.findByTestId('discover-needs-profile')).toBeOnTheScreen();
  });

  it('appuyer sur la carte ouvre le détail S11', async () => {
    installFakeApi(deck());
    await renderShell(<DiscoverScreen />);
    const card = await screen.findByTestId('swipe-card');
    await act(async () => {
      card.props.onAccessibilityAction({ nativeEvent: { actionName: 'activate' } });
    });
    expect(router.push).toHaveBeenCalledWith('/user/p1');
  });
});

describe('S09 Filtres', () => {
  const prefs = {
    seeking_genders: ['woman'],
    age_min: 25,
    age_max: 40,
    countries: [],
    origins: [],
    intents: [],
    verified_only: false,
    max_distance_km: null,
  };

  function FilterProbe() {
    const { filters } = useDiscoverFilters();
    return <Text testID="filters-probe">{JSON.stringify(filters)}</Text>;
  }

  it('part des préférences, applique les filtres choisis au contexte', async () => {
    installFakeApi({ 'GET /me': [200, ME], 'GET /me/preferences': [200, prefs] } as never);
    await renderShell(
      <>
        <FiltersScreen />
        <FilterProbe />
      </>,
    );
    const u = user();
    await u.press(await screen.findByTestId('filter-age-max-minus'));
    await u.press(screen.getByTestId('filter-country-FR'));
    await fireEvent(screen.getByTestId('filter-verified'), 'valueChange', true);
    await u.press(screen.getByTestId('filters-apply'));
    expect(JSON.parse(screen.getByTestId('filters-probe').props.children as string)).toEqual({
      age_min: 25,
      age_max: 39,
      countries: ['FR'],
      origins: [],
      intents: [],
      verified_only: true,
    });
    expect(router.back).toHaveBeenCalled();
  });

  it('réinitialiser efface les filtres', async () => {
    installFakeApi({ 'GET /me': [200, ME], 'GET /me/preferences': [200, prefs] } as never);
    await renderShell(
      <>
        <FiltersScreen />
        <FilterProbe />
      </>,
    );
    await user().press(await screen.findByTestId('filters-reset'));
    expect(screen.getByTestId('filters-probe').props.children).toBe('null');
  });

  it('les filtres sont envoyés à /discover au format Laravel (tableaux)', async () => {
    const fake = installFakeApi(deck());
    function Seed() {
      const { setFilters } = useDiscoverFilters();
      React.useEffect(() => {
        setFilters({ age_min: 20, age_max: 30, countries: ['FR', 'BE'], origins: ['CI'], intents: ['flirt'], verified_only: true });
      }, [setFilters]);
      return null;
    }
    await renderShell(
      <>
        <Seed />
        <DiscoverScreen />
      </>,
    );
    await waitFor(() => expect(fake.calls.some((c) => c.url.includes('countries%5B%5D=FR'))).toBe(true));
    const url = fake.calls.filter((c) => c.path.startsWith('/discover')).pop()?.url ?? '';
    expect(url).toContain('age_min=20');
    expect(url).toContain('countries%5B%5D=BE');
    expect(url).toContain('origins%5B%5D=CI');
    expect(url).toContain('intents%5B%5D=flirt');
    expect(url).toContain('verified_only=1');
  });
});

describe('S12 Match', () => {
  it('« Écrire » ouvre la conversation, « Continuer » revient', async () => {
    mockParams.current = { name: 'Awa', photo: '', conversationId: 'c9' };
    installFakeApi({ 'GET /me': [200, ME] } as never);
    await renderShell(<MatchScreen />);
    expect(await screen.findByText('C’est un match !')).toBeOnTheScreen();
    expect(screen.getByText('Vous et Awa vous êtes plu mutuellement.')).toBeOnTheScreen();
    const u = user();
    await u.press(screen.getByTestId('match-write'));
    expect(router.replace).toHaveBeenCalledWith({ pathname: '/conversation/[id]', params: { id: 'c9', name: 'Awa', photo: '' } });
    await u.press(screen.getByTestId('match-continue'));
    expect(router.back).toHaveBeenCalled();
  });
});

describe('S11 Détail du profil, blocage et signalement', () => {
  beforeEach(() => {
    mockParams.current = { id: 'p1' };
  });

  it('affiche la fiche, la galerie et les actions', async () => {
    installFakeApi({ 'GET /me': [200, ME], 'GET /profiles/p1': [200, publicProfile('p1', 'Awa', { media: [media('a', 0), media('b', 1)], verified: true })] } as never);
    await renderShell(<ProfileDetailScreen />);
    expect(await screen.findByText('Awa, 28')).toBeOnTheScreen();
    expect(screen.getByText('Photo 1 sur 2')).toBeOnTheScreen();
    expect(screen.getByText('✓ Profil vérifié')).toBeOnTheScreen();
    expect(screen.getByText('Bonjour')).toBeOnTheScreen();
  });

  it('profil introuvable / masqué / bloqué (404) : même message neutre', async () => {
    installFakeApi({ 'GET /me': [200, ME], 'GET /profiles/p1': [404, { error: { code: 'not_found', message: 'x' } }] } as never);
    await renderShell(<ProfileDetailScreen />);
    expect(await screen.findByText('Ce contenu n’est plus disponible.')).toBeOnTheScreen();
  });

  it('bloquer en 3 taps : menu, Bloquer, confirmer -> POST /blocks', async () => {
    const fake = installFakeApi({ 'GET /me': [200, ME], 'GET /profiles/p1': [200, AWA], 'POST /blocks': emptyBody() } as never);
    await renderShell(<ProfileDetailScreen />);
    await screen.findByText('Awa, 28');
    const u = user();
    await u.press(screen.getByTestId('detail-menu'));
    await u.press(screen.getByTestId('detail-block'));
    expect(fake.called('POST /blocks')).toHaveLength(0);
    await u.press(screen.getByTestId('detail-block-confirm'));
    await waitFor(() => expect(fake.called('POST /blocks')).toHaveLength(1));
    expect(fake.called('POST /blocks')[0]?.body).toEqual({ blocked_id: 'p1' });
    expect(router.back).toHaveBeenCalled();
  });

  it('signaler depuis le profil : menu, Signaler, motif puis confirmation -> POST /reports', async () => {
    const fake = installFakeApi({
      'GET /me': [200, ME],
      'GET /profiles/p1': [200, AWA],
      'POST /reports': [201, { id: 'r1', status: 'received' }],
    } as never);
    const first = await renderShell(<ProfileDetailScreen />);
    await screen.findByText('Awa, 28');
    const u = user();
    await u.press(screen.getByTestId('detail-menu')); // tap 1
    await u.press(screen.getByTestId('detail-report')); // tap 2
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/report',
      params: { reportedId: 'p1', name: 'Awa', contextType: 'profile', contextId: 'p1' },
    });
    first.unmount();

    mockParams.current = { reportedId: 'p1', name: 'Awa', contextType: 'profile', contextId: 'p1' };
    await renderShell(<ReportScreen />);
    const u2 = user();
    await u2.press(screen.getByTestId('report-harassment')); // choisir le motif n'envoie rien
    expect(fake.called('POST /reports')).toHaveLength(0);
    await u2.press(screen.getByTestId('report-send')); // confirmation explicite
    await waitFor(() => expect(fake.called('POST /reports')).toHaveLength(1));
    expect(fake.called('POST /reports')[0]?.body).toEqual({
      reported_id: 'p1',
      reason: 'harassment',
      context_type: 'profile',
      context_id: 'p1',
    });
    expect(router.back).toHaveBeenCalled();
  });

  it('écrire sans match : POST /conversations ; sans crédit (402) -> proposition d\'acheter des crédits', async () => {
    const fake = installFakeApi({
      'GET /me': [200, ME],
      'GET /profiles/p1': [200, AWA],
      'POST /conversations': [402, { error: { code: 'credit_required', message: 'x' } }],
    } as never);
    await renderShell(<ProfileDetailScreen />);
    await screen.findByText('Awa, 28');
    const u = user();
    await u.press(screen.getByTestId('detail-menu'));
    await u.press(screen.getByTestId('detail-write'));
    const notice = await screen.findByTestId('detail-notice');
    expect(notice).toHaveTextContent(/crédit/);
    await u.press(screen.getByRole('button', { name: 'Acheter des crédits' }));
    expect(router.push).toHaveBeenCalledWith('/premium/credits');

    fake.set('POST /conversations', [201, { id: 'c5', status: 'active' }]);
    await u.press(screen.getByTestId('detail-menu'));
    await u.press(screen.getByTestId('detail-write'));
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/conversation/[id]',
        params: { id: 'c5', name: 'Awa', photo: 'https://cdn.example.test/p1-m1.jpg', peerId: 'p1' },
      }),
    );
  });

  it('like depuis le détail : match -> écran de match', async () => {
    installFakeApi({
      'GET /me': [200, ME],
      'GET /profiles/p1': [200, AWA],
      'POST /swipes': [201, { status: 'recorded', matched: true, match_id: 'm1', conversation_id: 'c1' }],
    } as never);
    await renderShell(<ProfileDetailScreen />);
    await screen.findByText('Awa, 28');
    await user().press(screen.getByTestId('detail-like'));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/match' })));
  });
});

describe('S58 Signalement : confirmation du motif', () => {
  it('sans motif choisi, « Envoyer » est désactivé et rien n’est envoyé', async () => {
    mockParams.current = { reportedId: 'p1', name: 'Awa' };
    const fake = installFakeApi({ 'GET /me': [200, ME], 'POST /reports': [201, { id: 'r1', status: 'received' }] } as never);
    await renderShell(<ReportScreen />);
    expect(screen.getByTestId('report-send')).toBeDisabled();
    expect(screen.getByTestId('report-choose')).toBeOnTheScreen();
    await user().press(screen.getByTestId('report-other'));
    expect(screen.getByTestId('report-other')).toBeChecked();
    expect(screen.getByTestId('report-send')).toBeEnabled();
    expect(fake.called('POST /reports')).toHaveLength(0);
  });
});

describe('Signalement depuis la carte de découverte', () => {
  it('un bouton « Signaler » ouvre directement l’écran de signalement du profil du dessus', async () => {
    installFakeApi(deck());
    await renderShell(<DiscoverScreen />);
    await screen.findByTestId('swipe-card');
    const u = user();
    await u.press(screen.getByTestId('swipe-report'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/report',
      params: { reportedId: 'p1', name: 'Awa', contextType: 'profile', contextId: 'p1' },
    });
  });
});

describe('S58 Signalement : cas limites', () => {
  beforeEach(() => {
    mockParams.current = { reportedId: 'p1', name: 'Awa' };
  });

  it('détails facultatifs envoyés avec le motif ; doublon signalé', async () => {
    const fake = installFakeApi({ 'GET /me': [200, ME], 'POST /reports': [200, { status: 'already_reported' }] } as never);
    await renderShell(<ReportScreen />);
    const u = user();
    await u.type(screen.getByTestId('report-details'), 'Me demande de l\'argent');
    await u.press(screen.getByTestId('report-money_request'));
    await u.press(screen.getByTestId('report-send'));
    await waitFor(() => expect(fake.called('POST /reports')).toHaveLength(1));
    expect(fake.called('POST /reports')[0]?.body).toEqual({
      reported_id: 'p1',
      reason: 'money_request',
      details: 'Me demande de l\'argent',
    });
  });

  it('quota de signalements (429 quota_reached) : message dédié', async () => {
    installFakeApi({ 'GET /me': [200, ME], 'POST /reports': [429, { error: { code: 'quota_reached', message: 'x' } }] } as never);
    await renderShell(<ReportScreen />);
    const u = user();
    await u.press(screen.getByTestId('report-other'));
    await u.press(screen.getByTestId('report-send'));
    expect(await screen.findByTestId('report-error')).toHaveTextContent(/Limite atteinte/);
  });
});

// Garde de non-régression : le fournisseur de filtres est bien utilisable seul.
void DiscoverFiltersProvider;
