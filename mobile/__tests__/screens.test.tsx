import { act, screen, userEvent } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import React from 'react';
import { AuthFormScreen } from '../src/features/auth/AuthFormScreen';
import { BasicProfileScreen } from '../src/features/onboarding/BasicProfileScreen';
import { AgeRefusedScreen } from '../src/features/signup/AgeRefusedScreen';
import { BirthdateScreen } from '../src/features/signup/BirthdateScreen';
import { ConsentsScreen } from '../src/features/signup/ConsentsScreen';
import { WelcomeScreen } from '../src/features/welcome/WelcomeScreen';
import { initialSignupState, SignupState } from '../src/flow/signupMachine';
import { resetDeviceIdCacheForTests } from '../src/storage/deviceId';
import { tokenStore } from '../src/storage/tokenStore';
import { jsonResponse, probe, renderApp } from './helpers/app';
import { redirects, resetRouterMocks, router } from './helpers/routerMock';

jest.mock('expo-router', () => require('./helpers/routerMock').expoRouterMock);

const consents = { terms: true, privacy: true, sensitive_data: true, marketing: false };
const atBirthdate: SignupState = { ...initialSignupState, step: 'birthdate', consents };
const atAccount: SignupState = {
  step: 'account',
  consents,
  ageToken: 'age-token-xyz',
  ageTokenExpiresAt: Date.now() + 10 * 60 * 1000,
};
const refused: SignupState = { step: 'refused', consents: null, ageToken: null, ageTokenExpiresAt: null };

const user = () => userEvent.setup();
const fetchMock = jest.fn();

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  tokenStore.resetCacheForTests();
  resetDeviceIdCacheForTests();
  resetRouterMocks();
});

function lastRequest() {
  const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [string, RequestInit];
  return { url, init, headers: init.headers as Record<string, string>, body: init.body ? JSON.parse(init.body as string) : undefined };
}

describe('S01 Accueil', () => {
  it('propose connexion et inscription ; l\'inscription démarre à S63', async () => {
    await renderApp(<WelcomeScreen />);
    await user().press(screen.getByRole('button', { name: 'Créer un compte' }));
    expect(router.push).toHaveBeenCalledWith('/signup/consents');
  });

  it('la connexion mène directement à S02 (ni S63 ni S68)', async () => {
    await renderApp(<WelcomeScreen />);
    await user().press(screen.getByRole('button', { name: 'Se connecter' }));
    expect(router.push).toHaveBeenCalledWith('/login');
    expect(router.push).not.toHaveBeenCalledWith(expect.stringContaining('consents'));
    expect(router.push).not.toHaveBeenCalledWith(expect.stringContaining('birthdate'));
  });

  it('la langue se change depuis l\'accueil', async () => {
    await renderApp(<WelcomeScreen />);
    await user().press(screen.getByTestId('language-toggle'));
    expect(screen.getByRole('button', { name: 'Create an account' })).toBeOnTheScreen();
  });
});

describe('S63 Consentements', () => {
  it('« Continuer » reste désactivé tant que les 3 cases obligatoires ne sont pas cochées', async () => {
    await renderApp(<ConsentsScreen />);
    const next = screen.getByTestId('consents-continue');
    expect(next).toBeDisabled();
    const u = user();

    await u.press(screen.getByTestId('consent-terms'));
    await u.press(screen.getByTestId('consent-privacy'));
    expect(next).toBeDisabled();

    // Le consentement marketing (facultatif) ne débloque rien.
    await u.press(screen.getByTestId('consent-marketing'));
    expect(next).toBeDisabled();

    await u.press(screen.getByTestId('consent-sensitive'));
    expect(next).toBeEnabled();
  });

  it('cases distinctes : chaque case a son propre rôle checkbox et son état', async () => {
    await renderApp(<ConsentsScreen />);
    expect(screen.getAllByRole('checkbox')).toHaveLength(4);
    await user().press(screen.getByTestId('consent-terms'));
    expect(screen.getByTestId('consent-terms')).toBeChecked();
    expect(screen.getByTestId('consent-privacy')).not.toBeChecked();
    expect(screen.getByTestId('consent-sensitive')).not.toBeChecked();
  });

  it('continuer enregistre les consentements et avance vers S68', async () => {
    await renderApp(<ConsentsScreen />);
    const u = user();
    for (const id of ['consent-terms', 'consent-privacy', 'consent-sensitive']) {
      await u.press(screen.getByTestId(id));
    }
    await u.press(screen.getByTestId('consents-continue'));
    expect(probe.flow()).toBe('birthdate');
    expect(router.push).toHaveBeenCalledWith('/signup/birthdate');
  });

  it('textes bilingues : français puis anglais', async () => {
    await renderApp(<ConsentsScreen />);
    expect(screen.getByText('Avant de commencer')).toBeOnTheScreen();
    expect(screen.getByText("J'accepte le traitement de mes données sensibles")).toBeOnTheScreen();
  });

  it('textes bilingues : version anglaise', async () => {
    await renderApp(<ConsentsScreen />, initialSignupState, 'en');
    expect(screen.getByText('Before you start')).toBeOnTheScreen();
    expect(screen.getByText('I agree to the processing of my sensitive data')).toBeOnTheScreen();
  });

  it('le bouton retour revient en arrière', async () => {
    await renderApp(<ConsentsScreen />);
    await user().press(screen.getByTestId('back-button'));
    expect(router.back).toHaveBeenCalled();
  });
});

describe('S68 Date de naissance', () => {
  async function pickDate(day: number, month: string, year: number) {
    const u = user();
    await u.press(screen.getByLabelText(`Jour ${day}`));
    await u.press(screen.getByLabelText(`Mois ${month}`));
    await u.press(screen.getByLabelText(`Année ${year}`));
  }

  it('sans consentements : redirigé vers S63', async () => {
    await renderApp(<BirthdateScreen />);
    expect(redirects).toContain('/signup/consents');
  });

  it('« Continuer » désactivé tant que la date est incomplète', async () => {
    await renderApp(<BirthdateScreen />, atBirthdate);
    expect(screen.getByTestId('birthdate-continue')).toBeDisabled();
    await user().press(screen.getByLabelText('Jour 7'));
    expect(screen.getByTestId('birthdate-continue')).toBeDisabled();
  });

  it('majeur : appelle age-check avec X-Device-Id puis passe à S02', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { age_token: 'AGE', expires_in: 600 }));
    await renderApp(<BirthdateScreen />, atBirthdate);
    await pickDate(7, 'mars', 1990);
    await user().press(screen.getByTestId('birthdate-continue'));

    const { url, headers, body } = lastRequest();
    expect(url).toBe('https://api.example.test/api/v1/auth/age-check');
    expect(body).toEqual({ birthdate: '1990-03-07' });
    expect(headers['X-Device-Id']).toMatch(/^[0-9a-f-]{36}$/i);
    expect(headers.Authorization).toBeUndefined();
    expect(probe.flow()).toBe('account');
    expect(router.push).toHaveBeenCalledWith('/signup/account');
  });

  it('une date de mineur est envoyée au serveur (le client ne juge pas) ; 403 -> S64 et parcours bloqué', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(403, { error: { code: 'age_not_eligible', message: 'Inscription impossible.' } }),
    );
    const year = new Date().getFullYear() - 10;
    await renderApp(<BirthdateScreen />, atBirthdate);
    await pickDate(1, 'janvier', year);
    await user().press(screen.getByTestId('birthdate-continue'));

    expect(lastRequest().body).toEqual({ birthdate: `${year}-01-01` });
    expect(probe.flow()).toBe('refused');
    expect(router.replace).toHaveBeenCalledWith('/signup/age-refused');
    expect(router.push).not.toHaveBeenCalledWith('/signup/account');
  });

  it('date inexistante (31 février) : erreur locale, aucun appel réseau', async () => {
    await renderApp(<BirthdateScreen />, atBirthdate);
    await pickDate(31, 'février', 1990);
    await user().press(screen.getByTestId('birthdate-continue'));
    expect(screen.getByText("Cette date n'existe pas.")).toBeOnTheScreen();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('429 : bannière avec délai, on reste sur S68', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(429, { error: { code: 'rate_limited', message: 'x' } }, { 'Retry-After': '30' }),
    );
    await renderApp(<BirthdateScreen />, atBirthdate);
    await pickDate(7, 'mars', 1990);
    await user().press(screen.getByTestId('birthdate-continue'));
    expect(screen.getByText('Trop de tentatives. Réessayez dans 30 secondes.')).toBeOnTheScreen();
    expect(probe.flow()).toBe('birthdate');
  });

  it('panne réseau : bannière avec « Réessayer »', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
    await renderApp(<BirthdateScreen />, atBirthdate);
    await pickDate(7, 'mars', 1990);
    await user().press(screen.getByTestId('birthdate-continue'));
    expect(screen.getByText('Connexion impossible. Vérifiez votre réseau et réessayez.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeOnTheScreen();
  });
});

describe('S64 Refus d\'âge', () => {
  it('message neutre, sans âge ni raison, sans retour vers la saisie', async () => {
    await renderApp(<AgeRefusedScreen />, refused);
    expect(screen.getByText('Inscription impossible')).toBeOnTheScreen();
    expect(screen.getByText('Nous ne pouvons pas créer de compte pour le moment.')).toBeOnTheScreen();
    expect(screen.queryByText(/18|ans|âge|mineur|majeur/i)).not.toBeOnTheScreen();
    expect(screen.queryByTestId('back-button')).not.toBeOnTheScreen();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    await user().press(screen.getByRole('button', { name: 'Fermer' }));
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('inaccessible sans refus : redirigé', async () => {
    await renderApp(<AgeRefusedScreen />, atBirthdate);
    expect(redirects).toContain('/signup/birthdate');
  });
});

describe('S02 Connexion (F00)', () => {
  async function fill(email: string, password: string) {
    const u = user();
    await u.type(screen.getByTestId('auth-email'), email);
    await u.type(screen.getByTestId('auth-password'), password);
  }

  it('fonctionne même après un refus d\'âge (ni S63 ni S68) et ouvre la session', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { token: 'SANCTUM', user: { id: 'u1', email: 'a@b.fr', locale: 'fr' } }),
    );
    await renderApp(<AuthFormScreen mode="login" />, refused);
    expect(redirects).toEqual([]);
    await fill('a@b.fr', 'nimportequoi');
    await user().press(screen.getByTestId('auth-submit'));

    const { url, body, headers } = lastRequest();
    expect(url).toBe('https://api.example.test/api/v1/auth/login');
    expect(body).toMatchObject({ email: 'a@b.fr', password: 'nimportequoi' });
    expect(['ios', 'android']).toContain(body.platform);
    expect(headers.Authorization).toBeUndefined();
    expect(probe.auth()).toBe('signedIn');
    expect(probe.onboardingPending()).toBe('false');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('ayelo.auth_token', 'SANCTUM');
  });

  it('identifiants invalides : bannière traduite, pas de session', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, { error: { code: 'invalid_credentials', message: 'Identifiants invalides.' } }),
    );
    await renderApp(<AuthFormScreen mode="login" />);
    await fill('a@b.fr', 'mauvais');
    await user().press(screen.getByTestId('auth-submit'));
    expect(screen.getByText('Adresse e-mail ou mot de passe incorrect.')).toBeOnTheScreen();
    expect(probe.auth()).toBe('signedOut');
  });

  it('champs invalides : erreurs locales, aucun appel réseau', async () => {
    await renderApp(<AuthFormScreen mode="login" />);
    await user().press(screen.getByTestId('auth-submit'));
    expect(screen.getByText('Saisissez votre adresse e-mail.')).toBeOnTheScreen();
    expect(screen.getByText('Saisissez votre mot de passe.')).toBeOnTheScreen();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('S02 Inscription (F01)', () => {
  it('sans passer par S63 / S68 : redirigé', async () => {
    await renderApp(<AuthFormScreen mode="register" />);
    expect(redirects).toContain('/signup/consents');
  });

  it('envoie age_token et consentements, ouvre la session et déclenche l\'onboarding', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(201, { token: 'NEWTOKEN', user: { id: 'u2', email: 'new@b.fr', locale: 'fr' } }),
    );
    await renderApp(<AuthFormScreen mode="register" />, atAccount);
    const u = user();
    await u.type(screen.getByTestId('auth-email'), 'new@b.fr');
    await u.type(screen.getByTestId('auth-password'), 'Motdepasse123');
    await u.press(screen.getByTestId('auth-submit'));

    const { url, body } = lastRequest();
    expect(url).toBe('https://api.example.test/api/v1/auth/register');
    expect(body).toMatchObject({
      email: 'new@b.fr',
      age_token: 'age-token-xyz',
      consents: { terms: true, privacy: true, sensitive_data: true, marketing: false },
      locale: 'fr',
    });
    expect(probe.auth()).toBe('signedIn');
    expect(probe.onboardingPending()).toBe('true');
  });

  it('mot de passe trop faible : erreur locale avant tout appel', async () => {
    await renderApp(<AuthFormScreen mode="register" />, atAccount);
    const u = user();
    await u.type(screen.getByTestId('auth-email'), 'new@b.fr');
    await u.type(screen.getByTestId('auth-password'), 'court1');
    await u.press(screen.getByTestId('auth-submit'));
    expect(
      screen.getByText('Le mot de passe doit contenir au moins 10 caractères, avec des lettres et des chiffres.'),
    ).toBeOnTheScreen();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('422 : affiche les erreurs de champ renvoyées par le serveur', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(422, {
        error: { code: 'validation_failed', message: 'x', fields: { email: ['Cette adresse est déjà utilisée.'] } },
      }),
    );
    await renderApp(<AuthFormScreen mode="register" />, atAccount);
    const u = user();
    await u.type(screen.getByTestId('auth-email'), 'pris@b.fr');
    await u.type(screen.getByTestId('auth-password'), 'Motdepasse123');
    await u.press(screen.getByTestId('auth-submit'));
    expect(screen.getByText('Cette adresse est déjà utilisée.')).toBeOnTheScreen();
    expect(probe.auth()).toBe('signedOut');
  });

  it('jeton d\'âge expiré côté serveur (422 age_token) : retour à S68', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(422, { error: { code: 'validation_failed', message: 'x', fields: { age_token: ['expiré'] } } }),
    );
    await renderApp(<AuthFormScreen mode="register" />, atAccount);
    const u = user();
    await u.type(screen.getByTestId('auth-email'), 'new@b.fr');
    await u.type(screen.getByTestId('auth-password'), 'Motdepasse123');
    await u.press(screen.getByTestId('auth-submit'));
    expect(probe.flow()).toBe('birthdate');
  });

  it('403 age_not_eligible au register : bascule vers S64', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(403, { error: { code: 'age_not_eligible', message: 'Inscription impossible.' } }),
    );
    await renderApp(<AuthFormScreen mode="register" />, atAccount);
    const u = user();
    await u.type(screen.getByTestId('auth-email'), 'new@b.fr');
    await u.type(screen.getByTestId('auth-password'), 'Motdepasse123');
    await u.press(screen.getByTestId('auth-submit'));
    expect(probe.flow()).toBe('refused');
    expect(router.replace).toHaveBeenCalledWith('/signup/age-refused');
  });
});

describe('S04 Profil de base', () => {
  it('valide nom, genre, pays et ville avant de continuer vers S05', async () => {
    await renderApp(<BasicProfileScreen />);
    const u = user();
    await u.press(screen.getByTestId('profile-continue'));
    expect(screen.getByText('Entre 2 et 40 caractères.', { exact: true })).toBeOnTheScreen();
    expect(router.push).not.toHaveBeenCalled();

    await u.type(screen.getByTestId('profile-name'), 'Awa');
    await u.press(screen.getByTestId('gender-woman'));
    await u.press(screen.getByTestId('country-SN'));
    await u.type(screen.getByTestId('profile-city'), 'Dakar');
    await u.press(screen.getByTestId('profile-continue'));
    expect(router.push).toHaveBeenCalledWith('/onboarding/intent');
  });
});

afterAll(() => {
  jest.restoreAllMocks();
});

// Évite un avertissement « act » résiduel dû aux lectures asynchrones du stockage au démarrage.
afterEach(async () => {
  await act(async () => undefined);
});
