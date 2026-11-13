import { act, screen, userEvent, within } from '@testing-library/react-native';
import React from 'react';
import { Dimensions, ScaledSize } from 'react-native';
import { INTENTS } from '../src/api/types';
import { BasicProfileScreen } from '../src/features/onboarding/BasicProfileScreen';
import { IntentScreen } from '../src/features/onboarding/IntentScreen';
import { INTENT_ICONS } from '../src/features/onboarding/intentIcons';
import { ONBOARDING_STEPS, ONBOARDING_STEP_KEYS, onboardingStepNumber } from '../src/features/onboarding/steps';
import { PhotosScreen } from '../src/features/photos/PhotosScreen';
import { PreferencesScreen } from '../src/features/preferences/PreferencesScreen';
import { en } from '../src/i18n/en';
import { fr } from '../src/i18n/fr';
import { colors, MIN_TARGET } from '../src/theme';
import { Chip, ChoiceCard, Stepper } from '../src/ui';
import { ICON_NAMES } from '../src/ui/icons';
import { renderApp } from './helpers/app';
import { emptyBody, installFakeApi } from './helpers/fakeApi';
import { meFixture } from './helpers/fixtures';
import { flatStyle as flat, renderThemed } from './helpers/render';
import { resetRouterMocks } from './helpers/routerMock';

jest.mock('expo-router', () => ({
  ...require('./helpers/routerMock').expoRouterMock,
  useLocalSearchParams: jest.fn(() => ({})),
}));
jest.mock('../src/media/picker', () => ({ pickImage: jest.fn() }));

const user = () => userEvent.setup();
/** Les pictogrammes et noms d'étape sont masqués aux lecteurs d'écran : les requêtes doivent les inclure. */
const H = { includeHiddenElements: true } as const;

/** Simule une taille d'écran et un agrandissement du texte (useWindowDimensions lit Dimensions.get('window')). */
function mockWindow(width: number, height: number, fontScale: number) {
  const size: ScaledSize = { width, height, scale: 2, fontScale };
  jest.spyOn(Dimensions, 'get').mockImplementation(() => size);
}

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  resetRouterMocks();
  mockWindow(390, 844, 1);
});

afterEach(async () => {
  jest.restoreAllMocks();
  await act(async () => undefined);
});

const STEPS = [
  { key: 'a', label: 'Profil' },
  { key: 'b', label: 'Intention' },
  { key: 'c', label: 'Photos' },
  { key: 'd', label: 'Préférences' },
];

describe('Stepper : accessibilité', () => {
  it('une seule annonce « Étape 2 sur 4 », valeur et nom de l’étape en cours', async () => {
    await renderThemed(<Stepper steps={STEPS} current={2} label="Étape 2 sur 4" testID="st" />);
    const bar = screen.getByRole('progressbar', { name: 'Étape 2 sur 4' });
    expect(bar).toHaveAccessibilityValue({ min: 1, max: 4, now: 2, text: 'Intention' });
  });

  it('l’état est écrit en toutes lettres : « Étape 3 sur 4 · Photos », pas la couleur seule', async () => {
    await renderThemed(<Stepper steps={STEPS} current={3} label="Étape 3 sur 4" testID="st" />);
    expect(screen.getByText('Étape 3 sur 4 · Photos', H)).toBeOnTheScreen();
    for (const n of [1, 2, 3, 4]) expect(screen.getByTestId(`st-segment-${n}`, H)).toBeOnTheScreen();
  });

  it('un segment par étape : terminées claires, en cours = accent, à venir atténuées', async () => {
    await renderThemed(<Stepper steps={STEPS} current={3} label="Étape 3 sur 4" testID="st" onBrand />);
    const seg = (n: number) => flat(screen.getByTestId(`st-segment-${n}`, H).props.style);
    expect(seg(3).backgroundColor).toBe(colors.light.accent);
    expect(seg(1).backgroundColor).toBe(colors.light.onBrand);
    expect(seg(2).backgroundColor).toBe(colors.light.onBrand);
    expect(Number(seg(1).opacity)).toBeGreaterThan(Number(seg(4).opacity));
    expect(seg(4).backgroundColor).toBe(colors.light.onBrand);
    expect(Number(seg(4).height)).toBe(4);
  });

  it('seul le nom de l’étape en cours est affiché, à 320 pt comme à 200 % (une ligne, rien de coupé)', async () => {
    mockWindow(320, 640, 2);
    await renderThemed(<Stepper steps={STEPS} current={4} label="Étape 4 sur 4" testID="st" />);
    expect(screen.getByText('Étape 4 sur 4 · Préférences', H)).toBeOnTheScreen();
    expect(screen.queryByText('Profil', H)).not.toBeOnTheScreen();
  });

  it('suit les couleurs du thème sombre (étape en cours = accent sur le fond de marque)', async () => {
    await renderThemed(<Stepper steps={STEPS} current={2} label="Étape 2 sur 4" testID="st" onBrand />, { scheme: 'dark' });
    expect(flat(screen.getByTestId('st-segment-2', H).props.style).backgroundColor).toBe(colors.dark.accent);
  });
});

describe('étapes réelles du parcours', () => {
  it('quatre étapes, dans l’ordre de la machine d’onboarding, sans étape inventée', () => {
    expect(ONBOARDING_STEP_KEYS).toEqual(['profile', 'intent', 'photos', 'preferences']);
    expect(ONBOARDING_STEPS).toBe(4);
    expect(onboardingStepNumber('preferences')).toBe(4);
    for (const key of ONBOARDING_STEP_KEYS) {
      expect(fr[`onboarding.step.${key}`]).toBeTruthy();
      expect(en[`onboarding.step.${key}`]).toBeTruthy();
    }
  });

  it('profil : étape 1 sur 4, logo et titre', async () => {
    installFakeApi({ 'GET /me': [200, meFixture()] });
    await renderApp(<BasicProfileScreen />);
    expect(screen.getByRole('progressbar', { name: 'Étape 1 sur 4' })).toBeOnTheScreen();
    expect(screen.getByRole('image', { name: /ayelo/i })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Parlez-nous de vous' })).toBeOnTheScreen();
  });

  it('intention : étape 2 sur 4, cinq cartes avec pictogramme, bouton retour', async () => {
    installFakeApi({ 'GET /me': [200, meFixture()] });
    await renderApp(<IntentScreen />);
    expect(screen.getByRole('progressbar', { name: 'Étape 2 sur 4' })).toBeOnTheScreen();
    expect(screen.getAllByRole('radio')).toHaveLength(5);
    for (const intent of INTENTS) {
      expect(within(screen.getByTestId(`intent-${intent}`)).getByTestId(`icon-${INTENT_ICONS[intent]}`, H)).toBeOnTheScreen();
    }
    expect(screen.getByRole('button', { name: 'Retour' })).toBeOnTheScreen();
  });

  it('photos : étape 3 sur 4', async () => {
    installFakeApi({ 'GET /me': [200, meFixture()] });
    await renderApp(<PhotosScreen />);
    expect(screen.getByRole('progressbar', { name: 'Étape 3 sur 4' })).toBeOnTheScreen();
  });

  it('chaque intention a un pictogramme du registre existant', () => {
    for (const intent of INTENTS) expect(ICON_NAMES).toContain(INTENT_ICONS[intent]);
  });
});

describe('Chip et ChoiceCard : état sélectionné', () => {
  it('Chip sélectionnée : coche + bordure primary 2 pt sur fond d’écran ; non sélectionnée : surface, sans coche', async () => {
    const onPress = jest.fn();
    await renderThemed(
      <>
        <Chip testID="on" label="Des femmes" selected onPress={onPress} />
        <Chip testID="off" label="Des hommes" selected={false} onPress={onPress} />
      </>,
    );
    const on = screen.getByRole('checkbox', { name: 'Des femmes' });
    const off = screen.getByRole('checkbox', { name: 'Des hommes' });
    expect(on).toBeChecked();
    expect(off).not.toBeChecked();
    expect(screen.getByTestId('on-check', H)).toBeOnTheScreen();
    expect(screen.queryByTestId('off-check', H)).not.toBeOnTheScreen();
    expect(flat(on.props.style).borderColor).toBe(colors.light.primary);
    expect(flat(on.props.style).backgroundColor).toBe(colors.light.bg);
    expect(flat(on.props.style).borderWidth).toBe(2);
    expect(flat(off.props.style).backgroundColor).toBe(colors.light.surface);
    expect(flat(off.props.style).borderWidth).toBe(2);
    expect(Number(flat(on.props.style).minHeight)).toBeGreaterThanOrEqual(MIN_TARGET);
    await user().press(off);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('Chip : le libellé peut passer à la ligne (pas de limite de lignes) à 320 pt et 200 %', async () => {
    mockWindow(320, 640, 2);
    await renderThemed(<Chip label="Un libellé de puce très long pour vérifier le retour à la ligne" selected onPress={jest.fn()} />);
    expect(screen.getByText(/Un libellé de puce/).props.numberOfLines).toBeUndefined();
  });

  it('ChoiceCard sélectionnée : coche, bordure primary 2 pt sur fond d’écran, pictogramme décoratif ; état radio lisible', async () => {
    await renderThemed(
      <>
        <ChoiceCard testID="c1" icon="Heart" label="Mariage" description="Fonder un foyer" selected onPress={jest.fn()} />
        <ChoiceCard testID="c2" icon="Sparkles" label="Flirt" selected={false} onPress={jest.fn()} />
      </>,
    );
    const on = screen.getByRole('radio', { name: 'Mariage. Fonder un foyer' });
    const off = screen.getByRole('radio', { name: 'Flirt' });
    expect(on).toBeChecked();
    expect(off).not.toBeChecked();
    expect(screen.getByTestId('c1-check', H)).toBeOnTheScreen();
    expect(screen.queryByTestId('c2-check', H)).not.toBeOnTheScreen();
    expect(flat(on.props.style).borderColor).toBe(colors.light.primary);
    expect(flat(on.props.style).backgroundColor).toBe(colors.light.bg);
    expect(flat(off.props.style).backgroundColor).toBe(colors.light.surface);
    expect(Number(flat(off.props.style).minHeight)).toBeGreaterThanOrEqual(MIN_TARGET);
    expect(screen.getByTestId('icon-Heart', H)).toBeOnTheScreen();
  });
});

describe('Préférences : exactement les champs de l’API', () => {
  const prefs = {
    seeking_genders: ['woman'],
    age_min: 25,
    age_max: 35,
    countries: [],
    origins: [],
    intents: [],
    verified_only: false,
    max_distance_km: null,
  };

  const fakes = () =>
    installFakeApi({
      'GET /me/preferences': [200, prefs],
      'PUT /me/preferences': [200, prefs],
      'GET /me': [200, meFixture()],
      'POST /auth/logout': [204, emptyBody],
    } as never);

  it('onboarding : étape 4 sur 4, six champs réels, valeurs de l’API, rien de précoché en plus', async () => {
    fakes();
    await renderApp(<PreferencesScreen mode="onboarding" />);
    expect(await screen.findByTestId('pref-seeking-woman')).toBeChecked();
    expect(screen.getByRole('progressbar', { name: 'Étape 4 sur 4' })).toBeOnTheScreen();
    expect(screen.getByTestId('pref-seeking-man')).not.toBeChecked();
    expect(screen.getByTestId('pref-age-min-value')).toHaveTextContent('Âge minimum : 25');
    expect(screen.getByTestId('pref-age-max-value')).toHaveTextContent('Âge maximum : 35');
    expect(screen.getByTestId('pref-age-summary')).toHaveTextContent('25 – 35 ans');
    expect(screen.getByTestId('pref-country-FR')).not.toBeChecked();
    expect(screen.getByTestId('pref-origin-CI')).not.toBeChecked();
    expect(screen.getByTestId('pref-intent-flirt')).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'Profils vérifiés uniquement' })).not.toBeChecked();
    expect(screen.getByTestId('prefs-save')).toHaveTextContent('Terminer');
  });

  it('aucun critère hors API : pas de distance, d’études, de profession ni de valeurs', async () => {
    fakes();
    await renderApp(<PreferencesScreen mode="onboarding" />);
    await screen.findByTestId('pref-seeking-woman');
    const forbidden = /distance|\bkm\b|études|etudes|diplôme|profession|emploi|salari|valeurs|critères|criteres|education/i;
    expect(screen.queryAllByText(forbidden)).toEqual([]);
    expect(screen.queryByRole('slider')).not.toBeOnTheScreen();
    // Les titres de section sont exactement ceux des champs de l'API.
    for (const title of ['Je souhaite rencontrer', 'Âge', 'Pays de résidence', 'Pays d’origine', 'Intentions']) {
      expect(screen.getByRole('header', { name: new RegExp(`^${title}`) })).toBeOnTheScreen();
    }
  });

  it('en anglais aussi : aucun critère hors API', async () => {
    fakes();
    await renderApp(<PreferencesScreen mode="onboarding" />, undefined, 'en');
    await screen.findByTestId('pref-seeking-woman');
    expect(screen.queryAllByText(/distance|\bkm\b|education|degree|profession|occupation|values|criteria/i)).toEqual([]);
    expect(screen.getByRole('progressbar', { name: 'Step 4 of 4' })).toBeOnTheScreen();
  });

  it('champs facultatifs marqués « facultatif » ; l’âge ne l’est pas', async () => {
    fakes();
    await renderApp(<PreferencesScreen mode="onboarding" />);
    await screen.findByTestId('pref-seeking-woman');
    for (const title of ['Je souhaite rencontrer', 'Pays de résidence', 'Pays d’origine', 'Intentions']) {
      expect(screen.getByRole('header', { name: new RegExp(`^${title}.*facultatif`) })).toBeOnTheScreen();
    }
    expect(screen.getByRole('header', { name: /^Âge$/ })).toBeOnTheScreen();
  });

  it('mode réglages : pas de stepper, titre et bouton « Enregistrer »', async () => {
    fakes();
    await renderApp(<PreferencesScreen mode="edit" />);
    await screen.findByTestId('pref-seeking-woman');
    expect(screen.queryByRole('progressbar')).not.toBeOnTheScreen();
    expect(screen.getByTestId('prefs-save')).toHaveTextContent('Enregistrer');
  });

  it('validation inchangée : monter l’âge minimum au-delà du maximum remonte le maximum', async () => {
    fakes();
    await renderApp(<PreferencesScreen mode="onboarding" />);
    await screen.findByTestId('pref-seeking-woman');
    const u = user();
    for (let i = 0; i < 12; i += 1) await u.press(screen.getByTestId('pref-age-min-plus'));
    expect(screen.getByTestId('pref-age-min-value')).toHaveTextContent('Âge minimum : 37');
    expect(screen.getByTestId('pref-age-max-value')).toHaveTextContent('Âge maximum : 37');
    // Douze appuis userEvent sur l'écran complet : environ 3,4 s seul, plus sous charge (suite en parallèle). Délai explicite.
  }, 30000);

  it('boutons d’âge : cibles >= 44 pt et libellés d’action accessibles', async () => {
    fakes();
    await renderApp(<PreferencesScreen mode="onboarding" />);
    await screen.findByTestId('pref-seeking-woman');
    for (const name of ['Augmenter l’âge minimum', 'Diminuer l’âge minimum', 'Augmenter l’âge maximum', 'Diminuer l’âge maximum']) {
      const button = screen.getByRole('button', { name });
      expect(Number(flat(button.props.style).minHeight)).toBeGreaterThanOrEqual(MIN_TARGET);
      expect(Number(flat(button.props.style).minWidth)).toBeGreaterThanOrEqual(MIN_TARGET);
    }
  });

  it('puces : la sélection ajoute la coche et se défait au second appui', async () => {
    fakes();
    await renderApp(<PreferencesScreen mode="onboarding" />);
    await screen.findByTestId('pref-seeking-woman');
    const u = user();
    expect(screen.queryByTestId('pref-intent-flirt-check', H)).not.toBeOnTheScreen();
    await u.press(screen.getByTestId('pref-intent-flirt'));
    expect(screen.getByTestId('pref-intent-flirt')).toBeChecked();
    expect(screen.getByTestId('pref-intent-flirt-check', H)).toBeOnTheScreen();
    await u.press(screen.getByTestId('pref-intent-flirt'));
    expect(screen.getByTestId('pref-intent-flirt')).not.toBeChecked();
  });

  it('chargement : squelettes ; erreur réseau : message et « Réessayer » dans le panneau', async () => {
    installFakeApi({ 'GET /me/preferences': [503, { error: { code: 'server_error', message: 'x' } }] });
    await renderApp(<PreferencesScreen mode="onboarding" />);
    expect(await screen.findByTestId('async-retry')).toBeOnTheScreen();
    expect(screen.getByTestId('prefs-save')).toBeDisabled();
  });
});
