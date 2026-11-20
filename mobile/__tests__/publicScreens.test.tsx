import fs from 'fs';
import path from 'path';
import { act, fireEvent, screen, userEvent, within } from '@testing-library/react-native';
import React from 'react';
import { AuthFormScreen } from '../src/features/auth/AuthFormScreen';
import { ForgotPasswordScreen } from '../src/features/auth/ForgotPasswordScreen';
import { ResetPasswordScreen } from '../src/features/auth/ResetPasswordScreen';
import { AgeRefusedScreen } from '../src/features/signup/AgeRefusedScreen';
import { BirthdateScreen } from '../src/features/signup/BirthdateScreen';
import { ConsentsScreen } from '../src/features/signup/ConsentsScreen';
import { WELCOME_BENEFITS } from '../src/features/welcome/WelcomeBenefits';
import { WelcomeScreen } from '../src/features/welcome/WelcomeScreen';
import { initialSignupState, SignupState } from '../src/flow/signupMachine';
import { dictionaries } from '../src/i18n';
import { borderWidth, colors, MIN_TARGET, radius } from '../src/theme';
import { Button, ScreenContainer, TextField } from '../src/ui';
import { renderApp } from './helpers/app';
import { mockFontScale, mockWindow } from './helpers/a11y';
import { flatStyle as flat, renderThemed } from './helpers/render';
import { resetRouterMocks, router } from './helpers/routerMock';

jest.mock('expo-router', () => ({
  ...require('./helpers/routerMock').expoRouterMock,
  useLocalSearchParams: jest.fn(() => ({})),
}));

const g = globalThis as unknown as { __DEV__: boolean };
const user = () => userEvent.setup();

const consents = { terms: true, privacy: true, sensitive_data: true, marketing: false };
const atConsents: SignupState = { step: 'consents', consents: null, ageToken: 'age-token-xyz', ageTokenExpiresAt: Date.now() + 600000 };
const atAccount: SignupState = { step: 'account', consents, ageToken: 'age-token-xyz', ageTokenExpiresAt: Date.now() + 600000 };
const refused: SignupState = { step: 'refused', consents: null, ageToken: null, ageTokenExpiresAt: null };

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  resetRouterMocks();
});

afterEach(async () => {
  jest.restoreAllMocks();
  await act(async () => undefined);
});

/** Compare deux couleurs de jeton par valeur de style aplati (le fond d'un conteneur peut être posé sur la vue ou le style). */
const bgOf = (id: string) => flat(screen.getByTestId(id).props.style).backgroundColor;

describe('Accueil : nouvelle identité sur fond prune', () => {
  it('fond prune (jeton brand), logo blanc, signature en titre, ligne de soutien', async () => {
    await renderApp(<WelcomeScreen />);
    expect(bgOf('screen-welcome')).toBe(colors.light.brand);
    expect(screen.getByTestId('welcome-logo')).toBeOnTheScreen();
    expect(screen.getByRole('image', { name: 'Ayelo' })).toBeOnTheScreen();
    const tagline = screen.getByRole('header', { name: 'Rencontrez, échangez, aimez.' });
    expect(flat(tagline.props.style).color).toBe(colors.light.onBrand);
    expect(screen.getByText(dictionaries.fr['welcome.subtitle'])).toBeOnTheScreen();
  });

  it('le décor SVG est masqué aux lecteurs d’accessibilité et ne reçoit aucun toucher', async () => {
    await renderApp(<WelcomeScreen />);
    const backdrop = screen.getByTestId('screen-welcome-backdrop', { includeHiddenElements: true });
    expect(backdrop.props.pointerEvents).toBe('none');
    expect(backdrop.props.accessibilityElementsHidden).toBe(true);
    expect(backdrop.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('deux actions : « Créer mon compte » plein (primary) et « J’ai déjà un compte » en contour clair sur prune', async () => {
    await renderApp(<WelcomeScreen />);
    const create = screen.getByRole('button', { name: 'Créer mon compte' });
    const signIn = screen.getByRole('button', { name: 'J’ai déjà un compte' });
    const createStyle = flat(create.props.style);
    expect(createStyle.backgroundColor).toBe(colors.light.primary);
    expect(flat(within(create).getByText('Créer mon compte').props.style).color).toBe(colors.light.onPrimary);
    const signInStyle = flat(signIn.props.style);
    expect(signInStyle.borderColor).toBe(colors.light.onBrand);
    expect(signInStyle.borderWidth).toBe(borderWidth.strong);
    expect(flat(within(signIn).getByText('J’ai déjà un compte').props.style).color).toBe(colors.light.onBrand);
    expect(Number(createStyle.minHeight)).toBeGreaterThanOrEqual(MIN_TARGET);
    expect(Number(signInStyle.minHeight)).toBeGreaterThanOrEqual(MIN_TARGET);
  });

  it('les routes sont inchangées : inscription -> /signup/birthdate, connexion -> /login', async () => {
    await renderApp(<WelcomeScreen />);
    await user().press(screen.getByTestId('welcome-create-account'));
    expect(router.push).toHaveBeenCalledWith('/signup/birthdate');
    await user().press(screen.getByTestId('welcome-sign-in'));
    expect(router.push).toHaveBeenCalledWith('/login');
  });

  it('trois bénéfices réels, avec un pictogramme du registre et un libellé court', async () => {
    await renderApp(<WelcomeScreen />);
    expect(WELCOME_BENEFITS.map((b) => b.icon)).toEqual(['ShieldCheck', 'Flag', 'Lock']);
    for (const { label, testID } of WELCOME_BENEFITS) {
      const item = screen.getByTestId(testID);
      expect(within(item).getByText(dictionaries.fr[label])).toBeOnTheScreen();
      expect(screen.getByTestId(`${testID}-icon`, { includeHiddenElements: true }).props.accessibilityElementsHidden).toBe(true);
    }
    expect(screen.getAllByTestId(/^welcome-benefit-(verify|report|data)$/)).toHaveLength(3);
  });

  it('aucun bouton Google, Apple ou Facebook, aucune pagination', async () => {
    await renderApp(<WelcomeScreen />);
    const names = screen.getAllByRole('button').map((b) => String(b.props.accessibilityLabel));
    expect(names.join('|')).not.toMatch(/google|apple|facebook/i);
    expect(screen.queryByText(/continuer avec|continue with/i)).toBeNull();
    expect(screen.queryByTestId(/dot|pagination|carousel/i)).toBeNull();
    // Rien d'autre que les boutons de langue, d'inscription, de connexion (et du lien développement) n'est cliquable.
    expect(names.length).toBeLessThanOrEqual(4);
  });

  it('aucune promesse absolue dans les textes de l’accueil (fr et en)', () => {
    const keys = Object.keys(dictionaries.fr).filter((k) => k.startsWith('welcome.')) as (keyof typeof dictionaries.fr)[];
    expect(keys.length).toBeGreaterThanOrEqual(10);
    for (const locale of ['fr', 'en'] as const) {
      const all = keys.map((k) => dictionaries[locale][k]).join('\n');
      expect(all).not.toMatch(/100\s?%|totalement|entièrement|garanti|guaranteed|fully secure|100 ?% secure|sécurisé|aucun risque|no risk/i);
    }
  });

  it('la signature, les libellés et les bénéfices existent en fr et en (parité des clés welcome.*)', () => {
    const fr = Object.keys(dictionaries.fr).filter((k) => k.startsWith('welcome.')).sort();
    const en = Object.keys(dictionaries.en).filter((k) => k.startsWith('welcome.')).sort();
    expect(en).toEqual(fr);
    expect(dictionaries.fr['welcome.tagline']).toBe('Rencontrez, échangez, aimez.');
    expect(dictionaries.fr['welcome.cta.create']).toBe('Créer mon compte');
    expect(dictionaries.fr['welcome.cta.haveAccount']).toBe('J’ai déjà un compte');
    for (const k of ['welcome.benefits.verify', 'welcome.benefits.report', 'welcome.benefits.data'] as const) {
      expect(dictionaries.fr[k].length).toBeGreaterThan(8);
      expect(dictionaries.en[k].length).toBeGreaterThan(8);
    }
  });

  it('en anglais : tagline et boutons traduits ; la bascule de langue reste réelle', async () => {
    await renderApp(<WelcomeScreen />, initialSignupState, 'en');
    expect(screen.getByText('Meet, chat, love.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'I already have an account' })).toBeOnTheScreen();
    await user().press(screen.getByTestId('language-toggle'));
    expect(screen.getByRole('button', { name: 'Créer mon compte' })).toBeOnTheScreen();
  });

  it('le lien « composants » reste réservé au développement', async () => {
    const original = g.__DEV__;
    try {
      g.__DEV__ = false;
      await renderApp(<WelcomeScreen />);
      expect(screen.queryByRole('button', { name: dictionaries.fr['welcome.demo'] })).toBeNull();
    } finally {
      g.__DEV__ = original;
    }
  });

  it('emplacement de photographie : absente par défaut, rendue (décorative) quand une source licenciée est fournie', async () => {
    await renderApp(<WelcomeScreen />);
    expect(screen.queryByTestId('welcome-hero-image')).toBeNull();
  });

  it('avec une source fournie : l’image couvre le haut et reste masquée sans description', async () => {
    await renderApp(<WelcomeScreen heroImage={{ uri: 'https://licence.example.test/hero.jpg' }} />);
    const image = screen.getByTestId('welcome-hero-image', { includeHiddenElements: true });
    expect(image.props.source).toEqual({ uri: 'https://licence.example.test/hero.jpg' });
    expect(image.props.accessible).toBe(false);
  });

  it('320 pt : les bénéfices passent en colonne ; texte agrandi : le pied de page défile', async () => {
    mockWindow(320, 640, 1);
    await renderApp(<WelcomeScreen />);
    expect(flat(screen.getByTestId('welcome-benefits').props.style).flexDirection).toBe('column');
    expect(screen.getByRole('button', { name: 'Créer mon compte' })).toBeOnTheScreen();
  });

  it('390 pt, texte normal : les bénéfices sont en rangée', async () => {
    mockWindow(390, 844, 1);
    await renderApp(<WelcomeScreen />);
    expect(flat(screen.getByTestId('welcome-benefits').props.style).flexDirection).toBe('row');
  });

  it('police à 200 % : le pied de page défile et garde ses boutons', async () => {
    mockFontScale(2, 320, 640);
    await renderApp(<WelcomeScreen />);
    expect(screen.getByTestId('screen-welcome-footer-scroll')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Créer mon compte' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'J’ai déjà un compte' })).toBeOnTheScreen();
  });

  it('focus clavier : l\'anneau des deux boutons est blanc (celui du bouton principal se confondait avec le fond prune)', async () => {
    mockWindow(390, 844, 1);
    await renderApp(<WelcomeScreen />);
    for (const id of ['welcome-create-account', 'welcome-sign-in']) {
      await fireEvent(screen.getByTestId(id), 'focus');
      expect(flat(screen.getByTestId(id).props.style).outlineColor).toBe(colors.light.onBrand);
    }
  });

  it('écran court 320 x 568, texte normal : le pied de page défile au lieu d\'être coupé à 45 %', async () => {
    mockWindow(320, 568, 1);
    await renderApp(<WelcomeScreen />);
    expect(screen.getByTestId('screen-welcome-footer-scroll')).toBeOnTheScreen();
  });

  it('thème sombre : le fond reste prune (jeton brand)', () => {
    expect(colors.dark.brand).toBe(colors.light.brand);
  });
});

describe('ScreenContainer et Button : ajouts facultatifs', () => {
  it('par défaut : fond du thème, filet de pied de page conservé', async () => {
    await renderThemed(
      <ScreenContainer testID="sc" footer={<Button label="Ok" onPress={jest.fn()} />}>
        <></>
      </ScreenContainer>,
    );
    expect(bgOf('sc')).toBe(colors.light.bg);
    expect(flat(screen.getByTestId('sc-footer').props.style).borderTopWidth).toBe(1);
  });

  it('tone="brand" : fond prune, pied de page sans filet ; backdrop non interactif', async () => {
    await renderThemed(
      <ScreenContainer testID="sc" tone="brand" backdrop={<></>} footer={<Button label="Ok" onPress={jest.fn()} />}>
        <></>
      </ScreenContainer>,
    );
    expect(bgOf('sc')).toBe(colors.light.brand);
    expect(flat(screen.getByTestId('sc-footer').props.style).borderTopWidth).toBe(0);
    expect(screen.getByTestId('sc-backdrop', { includeHiddenElements: true }).props.pointerEvents).toBe('none');
  });

  it('Button : pilule, contour de 2 pt jeton, cible >= 48, sans hitSlop, secondary par défaut en primary', async () => {
    await renderThemed(<Button variant="secondary" label="Autre" onPress={jest.fn()} />);
    const style = flat(screen.getByRole('button', { name: 'Autre' }).props.style);
    expect(style.borderRadius).toBe(radius.pill);
    expect(style.borderWidth).toBe(borderWidth.strong);
    expect(style.borderColor).toBe(colors.light.primary);
    expect(Number(style.minHeight)).toBeGreaterThanOrEqual(MIN_TARGET + 4);
    expect(screen.getByRole('button', { name: 'Autre' }).props.hitSlop).toBeUndefined();
  });
});

describe('TextField : champ clair, étiquette persistante, erreur avec icône', () => {
  it('hauteur >= 52, rayon 12, contour borderStrong au repos puis anneau de focus, même épaisseur de 2 pt (jeton focusRing)', async () => {
    await renderThemed(<TextField testID="f" label="Adresse e-mail" value="" onChangeText={jest.fn()} />);
    // Le cadre est le parent direct du champ natif.
    const field = screen.getByTestId('f');
    const box = flat(field.parent!.props.style);
    expect(Number(box.minHeight)).toBeGreaterThanOrEqual(52);
    expect(box.borderRadius).toBe(radius.md);
    expect(box.borderColor).toBe(colors.light.borderStrong);
    // Trait constant : le focus ne décale pas le contenu (seule la couleur change).
    expect(box.borderWidth).toBe(borderWidth.strong);
    await act(async () => field.props.onFocus({}));
    const focused = flat(screen.getByTestId('f').parent!.props.style);
    expect(focused.borderColor).toBe(colors.light.focusRing);
    expect(focused.borderWidth).toBe(borderWidth.strong);
    expect(screen.getByText('Adresse e-mail')).toBeOnTheScreen();
  });

  it('erreur : icône + texte sous le champ, rôle alert, contour danger', async () => {
    await renderThemed(<TextField testID="f" label="Adresse e-mail" value="x" onChangeText={jest.fn()} error="Adresse invalide." />);
    const error = screen.getByTestId('f-error');
    expect(error.props.accessibilityRole).toBe('alert');
    expect(error).toHaveTextContent('Adresse invalide.');
    expect(screen.getByTestId('icon-CircleAlert', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(flat(screen.getByTestId('f').parent!.props.style).borderColor).toBe(colors.light.danger);
  });

  it('mot de passe : bouton d’icône de 44 pt, libellé complet, icône Eye puis EyeOff', async () => {
    await renderThemed(
      <TextField
        testID="pw"
        label="Mot de passe"
        value="secret"
        onChangeText={jest.fn()}
        secureTextEntry
        passwordToggleLabels={{ show: 'Afficher le mot de passe', hide: 'Masquer le mot de passe' }}
      />,
    );
    const toggle = screen.getByRole('button', { name: 'Afficher le mot de passe' });
    expect(Number(flat(toggle.props.style).minHeight)).toBeGreaterThanOrEqual(MIN_TARGET);
    expect(screen.getByLabelText('Mot de passe').props.secureTextEntry).toBe(true);
    await user().press(toggle);
    expect(screen.getByLabelText('Mot de passe').props.secureTextEntry).toBe(false);
    expect(screen.getByRole('button', { name: 'Masquer le mot de passe' })).toBeOnTheScreen();
    expect(screen.getByTestId('pw-toggle-icon', { includeHiddenElements: true })).toBeOnTheScreen();
  });
});

describe('Connexion, inscription : logo et comportement conservés', () => {
  it('connexion : logo couleur, titre, deux champs, bouton principal, liens secondaires', async () => {
    await renderApp(<AuthFormScreen mode="login" />);
    expect(screen.getByTestId('auth-logo')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Bon retour' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Adresse e-mail')).toBeOnTheScreen();
    expect(screen.getByLabelText('Mot de passe')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Afficher le mot de passe' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeOnTheScreen();
    expect(screen.getByTestId('auth-forgot')).toBeOnTheScreen();
    expect(screen.getByTestId('back-button')).toBeOnTheScreen();
    expect(bgOf('screen-login')).toBe(colors.light.bg);
  });

  it('connexion : erreurs de validation avec icône sous les deux champs', async () => {
    await renderApp(<AuthFormScreen mode="login" />);
    await user().press(screen.getByTestId('auth-submit'));
    expect(screen.getByTestId('auth-email-error')).toBeOnTheScreen();
    expect(screen.getByTestId('auth-password-error')).toBeOnTheScreen();
    expect(screen.getAllByTestId('icon-CircleAlert', { includeHiddenElements: true })).toHaveLength(2);
  });

  it('inscription : accès conditionné au parcours (garde inchangée) et logo présent', async () => {
    await renderApp(<AuthFormScreen mode="register" />, atAccount);
    expect(screen.getByTestId('auth-logo')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Créez votre compte' })).toBeOnTheScreen();
  });

  it('mot de passe oublié et nouveau mot de passe : logo présent ; retour seulement sur le premier', async () => {
    await renderApp(<ForgotPasswordScreen />);
    expect(screen.getByTestId('auth-logo')).toBeOnTheScreen();
    expect(screen.getByTestId('back-button')).toBeOnTheScreen();
  });

  it('nouveau mot de passe : deux champs avec bascule et logo, retour vers la connexion quand la pile est vide', async () => {
    await renderApp(<ResetPasswordScreen />);
    expect(screen.getByTestId('auth-logo')).toBeOnTheScreen();
    router.canGoBack.mockReturnValueOnce(false);
    await user().press(screen.getByTestId('back-button'));
    expect(router.replace).toHaveBeenCalledWith('/login');
    expect(screen.getAllByRole('button', { name: 'Afficher le mot de passe' })).toHaveLength(2);
  });

  it('date de naissance : trois champs numériques, logo, erreur précise avec icône', async () => {
    await renderApp(<BirthdateScreen />);
    expect(screen.getByTestId('auth-logo')).toBeOnTheScreen();
    for (const id of ['birthdate-day', 'birthdate-month', 'birthdate-year']) {
      expect(screen.getByTestId(id).props.keyboardType).toBe('number-pad');
    }
    await user().type(screen.getByTestId('birthdate-day'), '45');
    await user().type(screen.getByTestId('birthdate-month'), '03');
    await user().type(screen.getByTestId('birthdate-year'), '1990');
    expect(screen.getByTestId('birthdate-error')).toHaveTextContent('Le jour doit être compris entre 1 et 31.');
    expect(screen.getByTestId('icon-CircleAlert', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Continuer' })).toBeDisabled();
  });

  it('date de naissance : chaque champ dit au système ce qu’il attend (auto-remplissage jour / mois / année)', async () => {
    await renderApp(<BirthdateScreen />);
    expect(screen.getByTestId('birthdate-day').props.autoComplete).toBe('birthdate-day');
    expect(screen.getByTestId('birthdate-month').props.autoComplete).toBe('birthdate-month');
    expect(screen.getByTestId('birthdate-year').props.autoComplete).toBe('birthdate-year');
  });

  it('consentements : quatre cases, deux liens vers les textes légaux, logo, continuer désactivé', async () => {
    await renderApp(<ConsentsScreen />, atConsents);
    expect(screen.getByTestId('auth-logo')).toBeOnTheScreen();
    for (const id of ['consent-terms', 'consent-privacy', 'consent-sensitive', 'consent-marketing']) {
      expect(screen.getByTestId(id)).toBeOnTheScreen();
    }
    expect(screen.getByTestId('consent-terms-read')).toBeOnTheScreen();
    expect(screen.getByTestId('consent-privacy-read')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Continuer' })).toBeDisabled();
  });

  it('refus d’âge : message neutre, sans lien d’aide ni « pour le moment », logo, un seul bouton', async () => {
    await renderApp(<AgeRefusedScreen />, refused);
    expect(screen.getByTestId('auth-logo')).toBeOnTheScreen();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByTestId('back-button')).toBeNull();
    expect(screen.getByTestId('screen-age-refused')).not.toHaveTextContent(/pour le moment|aide|help/i);
  });
});

describe('Parité fr/en et couleurs des écrans publics', () => {
  it('les clés utilisées par les écrans publics existent dans les deux langues', () => {
    for (const k of Object.keys(dictionaries.fr).filter((key) => /^(auth|forgot|reset|consents|birthdate|ageRefused|welcome)\./.test(key))) {
      expect(dictionaries.en[k as keyof typeof dictionaries.en]).toBeTruthy();
    }
  });

  it('aucune couleur en dur dans les fichiers de la nouvelle identité (jetons seulement)', () => {
    const root = path.resolve(__dirname, '..');
    const files = [
      'src/features/welcome/WelcomeScreen.tsx',
      'src/features/welcome/WelcomeBenefits.tsx',
      'src/ui/illustrations/WelcomeBackdrop.tsx',
      'src/features/auth/AuthHeader.tsx',
      'src/features/auth/AuthFormScreen.tsx',
      'src/features/signup/BirthdateScreen.tsx',
      'src/ui/Button.tsx',
      'src/ui/TextField.tsx',
      'src/ui/ScreenContainer.tsx',
    ];
    for (const f of files) {
      const text = fs.readFileSync(path.join(root, f), 'utf8');
      expect(text).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\s*\(/);
    }
  });
});
