import { act, fireEvent, screen, userEvent, within } from '@testing-library/react-native';
import React from 'react';
import { Dimensions, ScaledSize } from 'react-native';
import { FiltersScreen } from '../src/features/discover/FiltersScreen';
import { ProfileEditScreen } from '../src/features/profile/ProfileEditScreen';
import { BlockedScreen } from '../src/features/settings/BlockedScreen';
import { ConsentSettingsScreen } from '../src/features/settings/ConsentSettingsScreen';
import { NotificationsScreen } from '../src/features/settings/NotificationsScreen';
import { PrivacyScreen } from '../src/features/settings/PrivacyScreen';
import { SessionsScreen } from '../src/features/settings/SessionsScreen';
import { SwitchGroup } from '../src/ui/SwitchGroup';
import { en } from '../src/i18n/en';
import { fr } from '../src/i18n/fr';
import { colors } from '../src/theme';
import { SwitchRow } from '../src/ui';
import { tokenStore } from '../src/storage/tokenStore';
import { resetDeviceIdCacheForTests } from '../src/storage/deviceId';
import { installFakeApi } from './helpers/fakeApi';
import { meFixture } from './helpers/fixtures';
import { flatStyle as flat, renderThemed } from './helpers/render';
import { resetRouterMocks, router } from './helpers/routerMock';
import { renderShell } from './helpers/shell';

jest.mock('expo-router', () => ({
  ...require('./helpers/routerMock').expoRouterMock,
  useLocalSearchParams: jest.fn(() => ({})),
}));

const ME = meFixture();
const user = () => userEvent.setup();
/** Les libellés de `SwitchRow` et les pictogrammes sont masqués aux lecteurs d'écran (l'interrupteur porte le nom) : requêtes avec masqués. */
const H = { includeHiddenElements: true } as const;
const prefs = { push_messages: true, push_matches: true, push_calls: true, push_marketing: false, email_marketing: false };

/** Simule une taille d'écran et un agrandissement du texte (useWindowDimensions lit Dimensions.get('window')). */
function mockWindow(width: number, height: number, fontScale: number) {
  const size: ScaledSize = { width, height, scale: 2, fontScale };
  jest.spyOn(Dimensions, 'get').mockImplementation(() => size);
}

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  tokenStore.resetCacheForTests();
  resetDeviceIdCacheForTests();
  resetRouterMocks();
  mockWindow(390, 844, 1);
});

afterEach(async () => {
  jest.restoreAllMocks();
  await act(async () => undefined);
});

describe('SwitchGroup', () => {
  const rows = (
    <SwitchGroup testID="grp">
      <SwitchRow testID="a" label="Premier" value onValueChange={() => undefined} divider={false} />
      <SwitchRow testID="b" label="Deuxième" value={false} onValueChange={() => undefined} divider={false} />
      <SwitchRow testID="c" label="Troisième" value onValueChange={() => undefined} divider={false} />
    </SwitchGroup>
  );

  it('carte surface arrondie, un filet entre deux lignes seulement (jamais avant la première)', async () => {
    await renderThemed(rows);
    const card = flat(screen.getByTestId('grp').props.style);
    expect(card.backgroundColor).toBe(colors.light.surface);
    expect(card.borderRadius).toBe(12);
    const wrappers = screen.getByTestId('grp').children.filter((c) => typeof c !== 'string') as { props: { style?: unknown } }[];
    const tops = wrappers.map((w) => flat(w.props.style).borderTopWidth);
    expect(tops).toEqual([undefined, 1, 1]);
  });

  it('thème sombre : fond et filets du thème sombre', async () => {
    await renderThemed(rows, { scheme: 'dark' });
    expect(flat(screen.getByTestId('grp').props.style).backgroundColor).toBe(colors.dark.surface);
    const second = (screen.getByTestId('grp').children[1] as { props: { style?: unknown } }).props.style;
    expect(flat(second).borderTopColor).toBe(colors.dark.border);
  });

  it('chaque interrupteur reste atteignable avec son nom et son état', async () => {
    await renderThemed(rows);
    expect(screen.getByRole('switch', { name: 'Premier' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Deuxième').props.accessibilityState).toMatchObject({ checked: false });
  });
});

describe('Notifications : deux groupes', () => {
  it('trois interrupteurs d’activité, deux de nouveautés, note sans point final', async () => {
    installFakeApi({ 'GET /me': [200, ME], 'GET /me/notifications': [200, prefs] });
    await renderShell(<NotificationsScreen />);
    await screen.findByTestId('notif-push_messages');
    for (const key of ['push_messages', 'push_matches', 'push_calls', 'push_marketing', 'email_marketing']) {
      expect(screen.getByTestId(`notif-${key}`)).toBeOnTheScreen();
    }
    expect(screen.getAllByRole('switch')).toHaveLength(5);
    expect(screen.getByText('Les notifications poussées nécessitent une autorisation du téléphone, demandée plus tard')).toBeOnTheScreen();
  });

  it('320 pt et texte à 200 % : tous les libellés restent présents (rien de coupé)', async () => {
    mockWindow(320, 640, 2);
    installFakeApi({ 'GET /me': [200, ME], 'GET /me/notifications': [200, prefs] });
    await renderShell(<NotificationsScreen />);
    await screen.findByTestId('notif-push_messages');
    expect(screen.getByText('Nouveautés et offres (notifications)', H)).toBeOnTheScreen();
    expect(screen.getByText('Nouveautés et offres (e-mails)', H)).toBeOnTheScreen();
  });
});

describe('Confidentialité et consentements', () => {
  it('confidentialité : trois interrupteurs dans une seule carte, aide sans point final', async () => {
    installFakeApi({ 'GET /me': [200, ME] });
    await renderShell(<PrivacyScreen />);
    await screen.findByTestId('privacy-visible');
    expect(screen.getAllByRole('switch')).toHaveLength(3);
    expect(screen.getByText('Désactivé, personne ne peut vous voir (vos conversations restent actives)', H)).toBeOnTheScreen();
  });

  it('consentements : introduction sans point final, quatre interrupteurs puis les deux documents', async () => {
    installFakeApi({
      'GET /me': [200, ME],
      'GET /me/consents': [200, { data: { marketing: { granted: false }, location: { granted: true }, sensitive_data: { granted: true }, verification_biometric: { granted: false } } }],
    });
    await renderShell(<ConsentSettingsScreen />);
    await screen.findByTestId('consent-marketing');
    expect(screen.getAllByRole('switch')).toHaveLength(4);
    expect(screen.getByText('Vous pouvez retirer ou accorder certains consentements à tout moment')).toBeOnTheScreen();
    expect(screen.getByText('Conditions d’utilisation (acceptées à l’inscription)')).toBeOnTheScreen();
    expect(screen.getByText('Politique de confidentialité (lue à l’inscription)')).toBeOnTheScreen();
  });

  it('retirer les données sensibles garde la confirmation avec une action danger distincte', async () => {
    installFakeApi({
      'GET /me': [200, ME],
      'GET /me/consents': [200, { data: { sensitive_data: { granted: true } } }],
    });
    await renderShell(<ConsentSettingsScreen />);
    await screen.findByTestId('consent-sensitive_data');
    await fireEvent(screen.getByTestId('consent-sensitive_data'), 'valueChange', false);
    expect(await screen.findByTestId('consent-revoke-confirm')).toBeOnTheScreen();
    expect(screen.getByTestId('consent-revoke-yes')).toBeOnTheScreen();
  });
});

describe('Appareils et personnes bloquées', () => {
  it('session courante : « Cet appareil · Dernière activité » (séparateur, pas de point)', async () => {
    installFakeApi({
      'GET /me': [200, ME],
      'GET /auth/sessions': [200, { data: [{ id: 's1', platform: 'android', app_version: '0.1.0', last_active_at: null, created_at: null, current: true }] }],
    });
    await renderShell(<SessionsScreen />);
    expect(await screen.findByText('Cet appareil · Dernière activité : inconnue')).toBeOnTheScreen();
    expect(screen.getByTestId('session-close-s1')).toBeOnTheScreen();
  });

  it('état vide des bloqués : description sans point final', async () => {
    installFakeApi({ 'GET /me': [200, ME], 'GET /blocks': [200, { data: [] }] });
    await renderShell(<BlockedScreen />);
    expect(await screen.findByText('Les personnes que vous bloquez apparaissent ici')).toBeOnTheScreen();
  });

  it('bloqué : action « Débloquer » avec le nom de la personne pour le lecteur d’écran', async () => {
    installFakeApi({
      'GET /me': [200, ME],
      'GET /blocks': [200, { data: [{ user_id: 'b1', display_name: 'Paul', created_at: '2026-11-01T00:00:00Z' }] }],
    });
    await renderShell(<BlockedScreen />);
    expect(await screen.findByRole('button', { name: 'Débloquer Paul' })).toBeOnTheScreen();
  });
});

describe('Modifier mon profil', () => {
  it('genre : trois tuiles dans un groupe radio, la sélection porte une coche et la bordure primaire', async () => {
    installFakeApi({ 'GET /me': [200, ME] });
    await renderShell(<ProfileEditScreen />);
    const group = await screen.findByLabelText('Genre');
    expect(within(group).getAllByRole('radio')).toHaveLength(3);
    // Le profil de test est une femme : la coche est sur « woman » seulement.
    expect(screen.getByTestId('edit-gender-woman-check', H)).toBeOnTheScreen();
    expect(screen.queryByTestId('edit-gender-man-check', H)).toBeNull();
    expect(flat(screen.getByTestId('edit-gender-woman').props.style).borderColor).toBe(colors.light.primary);
    expect(flat(screen.getByTestId('edit-gender-man').props.style).borderColor).toBe(colors.light.surface);
  });

  it('un appui change la sélection du genre et de l’intention', async () => {
    installFakeApi({ 'GET /me': [200, ME] });
    await renderShell(<ProfileEditScreen />);
    const u = user();
    await u.press(await screen.findByTestId('edit-gender-man'));
    expect(screen.getByTestId('edit-gender-man-check', H)).toBeOnTheScreen();
    expect(screen.queryByTestId('edit-gender-woman-check', H)).toBeNull();
    await u.press(screen.getByTestId('edit-intent-flirt'));
    expect(screen.getByTestId('edit-intent-flirt-check', H)).toBeOnTheScreen();
  });

  it('sections Intention et Photos : titres de niveau « header », ligne Préférences conservée', async () => {
    installFakeApi({ 'GET /me': [200, ME] });
    await renderShell(<ProfileEditScreen />);
    await screen.findByTestId('edit-name');
    expect(screen.getByRole('header', { name: 'Photos' })).toBeOnTheScreen();
    expect(screen.getByLabelText(fr['intent.title'])).toBeOnTheScreen();
    await user().press(screen.getByTestId('edit-preferences'));
    expect(router.push).toHaveBeenCalledWith('/settings/preferences');
  });

  it('la présentation garde son aide « 500 caractères au maximum » sans point final', async () => {
    installFakeApi({ 'GET /me': [200, ME] });
    await renderShell(<ProfileEditScreen />);
    expect(await screen.findByText('500 caractères au maximum')).toBeOnTheScreen();
  });

  it('320 pt et texte à 200 % : les trois tuiles de genre restent affichées et lisibles', async () => {
    mockWindow(320, 640, 2);
    installFakeApi({ 'GET /me': [200, ME] });
    await renderShell(<ProfileEditScreen />);
    for (const g of ['man', 'woman', 'other']) expect(await screen.findByTestId(`edit-gender-${g}`)).toBeOnTheScreen();
  });
});

describe('Filtres de la découverte', () => {
  it('reprend les champs de préférences (sans « Je souhaite rencontrer ») et garde Appliquer / Réinitialiser', async () => {
    installFakeApi({
      'GET /me': [200, ME],
      'GET /me/preferences': [200, { seeking_genders: ['woman'], age_min: 25, age_max: 40, countries: [], origins: [], intents: [], verified_only: false, max_distance_km: null }],
    });
    await renderShell(<FiltersScreen />);
    expect(await screen.findByTestId('filter-age-summary')).toBeOnTheScreen();
    expect(screen.queryByTestId('filter-seeking-woman')).toBeNull();
    expect(screen.getByTestId('filters-apply')).toBeOnTheScreen();
    expect(screen.getByTestId('filters-reset')).toBeOnTheScreen();
    expect(screen.getAllByText('Facultatif', { includeHiddenElements: true }).length).toBeGreaterThan(0);
  });
});

describe('Textes d’aide : pas de point final (fr et en)', () => {
  const KEYS = [
    'edit.bio.hint',
    'privacy.visible.hint',
    'notif.note',
    'blocked.empty.body',
    'consentSettings.intro',
    'consentSettings.sensitive_data.hint',
  ] as const;

  it.each(KEYS)('%s', (key) => {
    expect(fr[key]).not.toMatch(/[.]$/);
    expect(en[key]).not.toMatch(/[.]$/);
  });

  it('les messages d’erreur et de confirmation gardent leur point final', () => {
    expect(fr['edit.bio.tooLong']).toMatch(/[.]$/);
    expect(fr['sessions.closeAll.confirm']).toMatch(/[.]$/);
  });
});
