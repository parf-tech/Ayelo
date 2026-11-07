import fs from 'fs';
import path from 'path';
import { authReducer, initialAuthState } from '../src/auth/authState';
import { guardArea, ROUTES, signedInHome } from '../src/flow/authGuard';
import {
  initialSignupState,
  isAgeTokenValid,
  resolveSignupScreen,
  SignupEvent,
  signupReducer,
  SignupState,
} from '../src/flow/signupMachine';
import { toIsoBirthdate, validateEmail, validatePassword } from '../src/features/validation';

const allConsents = { terms: true, privacy: true, sensitive_data: true, marketing: false };
const run = (events: SignupEvent[], from: SignupState = initialSignupState) => events.reduce(signupReducer, from);

describe('machine d\'états d\'inscription : âge -> consentements -> inscription', () => {
  it('démarre sur la date de naissance (S68) : l\'âge est contrôlé avant tout consentement', () => {
    expect(initialSignupState.step).toBe('birthdate');
  });

  it('parcours nominal : S68 -> S63 -> S02', () => {
    const s1 = run([{ type: 'AGE_PASSED', ageToken: 'tok', expiresAt: 5000 }]);
    expect(s1.step).toBe('consents');
    expect(s1.ageToken).toBe('tok');
    expect(s1.consents).toBeNull();
    const s2 = signupReducer(s1, { type: 'CONSENTS_ACCEPTED', consents: allConsents });
    expect(s2.step).toBe('account');
    expect(s2.ageToken).toBe('tok');
    expect(s2.consents).toEqual(allConsents);
  });

  it('ne saute pas S68 : les consentements sont ignorés tant que l\'âge n\'est pas contrôlé', () => {
    const s = signupReducer(initialSignupState, { type: 'CONSENTS_ACCEPTED', consents: allConsents });
    expect(s).toBe(initialSignupState);
  });

  it.each([
    ['terms', { ...allConsents, terms: false }],
    ['privacy', { ...allConsents, privacy: false }],
    ['sensitive_data', { ...allConsents, sensitive_data: false }],
  ])('refuse d\'avancer sans le consentement obligatoire « %s »', (_name, consents) => {
    const atConsents = run([{ type: 'AGE_PASSED', ageToken: 'tok', expiresAt: 1 }]);
    const s = signupReducer(atConsents, { type: 'CONSENTS_ACCEPTED', consents });
    expect(s.step).toBe('consents');
    expect(s.consents).toBeNull();
  });

  it('marketing est facultatif : absent = false', () => {
    const s = run([
      { type: 'AGE_PASSED', ageToken: 'tok', expiresAt: 1 },
      { type: 'CONSENTS_ACCEPTED', consents: { terms: true, privacy: true, sensitive_data: true } },
    ]);
    expect(s.step).toBe('account');
    expect(s.consents?.marketing).toBe(false);
  });

  it('refus d\'âge : état terminal, avant tout consentement', () => {
    const s = run([{ type: 'AGE_REFUSED' }]);
    expect(s.step).toBe('refused');
    expect(s.consents).toBeNull();
    expect(s.ageToken).toBeNull();
  });

  it('refus d\'âge : bloque la suite (aucun événement ne permet d\'avancer)', () => {
    const refused = run([{ type: 'AGE_REFUSED' }]);
    const attempts: SignupEvent[] = [
      { type: 'AGE_PASSED', ageToken: 'tok', expiresAt: 9e12 },
      { type: 'CONSENTS_ACCEPTED', consents: allConsents },
      { type: 'AGE_TOKEN_EXPIRED' },
      { type: 'AGE_REFUSED' },
    ];
    for (const event of attempts) {
      expect(signupReducer(refused, event).step).toBe('refused');
    }
    // Seul RESET (nouveau départ depuis l'accueil) en sort ; le serveur refusera de nouveau (refus mémorisé).
    expect(signupReducer(refused, { type: 'RESET' })).toEqual(initialSignupState);
  });

  it('jeton d\'âge expiré : retour à S68, jeton effacé, consentements gardés ; la nouvelle date mène directement à S02', () => {
    const expired = run([
      { type: 'AGE_PASSED', ageToken: 'tok', expiresAt: 1000 },
      { type: 'CONSENTS_ACCEPTED', consents: allConsents },
      { type: 'AGE_TOKEN_EXPIRED' },
    ]);
    expect(expired.step).toBe('birthdate');
    expect(expired.ageToken).toBeNull();
    expect(expired.consents).toEqual(allConsents);
    const again = signupReducer(expired, { type: 'AGE_PASSED', ageToken: 'tok2', expiresAt: 2000 });
    expect(again.step).toBe('account');
    expect(again.ageToken).toBe('tok2');
  });

  it('le jeton d\'âge peut aussi expirer sur S63 (lecture longue des textes)', () => {
    const s = run([{ type: 'AGE_PASSED', ageToken: 'tok', expiresAt: 1000 }, { type: 'AGE_TOKEN_EXPIRED' }]);
    expect(s.step).toBe('birthdate');
    expect(s.ageToken).toBeNull();
  });

  it('un 403 au moment du register (S02) bascule aussi vers le refus', () => {
    const s = run([
      { type: 'AGE_PASSED', ageToken: 'tok', expiresAt: 1000 },
      { type: 'CONSENTS_ACCEPTED', consents: allConsents },
      { type: 'AGE_REFUSED' },
    ]);
    expect(s.step).toBe('refused');
    expect(s.consents).toBeNull();
  });

  it('retour en arrière puis nouvelle date : nouveau jeton accepté, étape atteinte conservée', () => {
    const s = run([
      { type: 'AGE_PASSED', ageToken: 'a', expiresAt: 1 },
      { type: 'AGE_PASSED', ageToken: 'b', expiresAt: 2 },
    ]);
    expect(s.ageToken).toBe('b');
    expect(s.step).toBe('consents');
  });

  it('isAgeTokenValid : jeton absent, valide, expiré', () => {
    const ok = run([{ type: 'AGE_PASSED', ageToken: 'a', expiresAt: 10_000 }]);
    expect(isAgeTokenValid(initialSignupState, 0)).toBe(false);
    expect(isAgeTokenValid(ok, 9_999)).toBe(true);
    expect(isAgeTokenValid(ok, 10_000)).toBe(false);
  });
});

describe('accès aux écrans du parcours (garde)', () => {
  const atBirthdate = initialSignupState;
  const atConsents = run([{ type: 'AGE_PASSED', ageToken: 't', expiresAt: 1 }]);
  const atAccount = signupReducer(atConsents, { type: 'CONSENTS_ACCEPTED', consents: allConsents });
  const refused = signupReducer(atBirthdate, { type: 'AGE_REFUSED' });

  it('S63 sans contrôle d\'âge : redirigé vers S68', () => {
    expect(resolveSignupScreen(atBirthdate, 'consents')).toEqual({ allowed: false, redirectTo: 'birthdate' });
  });

  it('S02 inscription sans contrôle d\'âge ou sans consentements : redirigé vers l\'étape manquante', () => {
    expect(resolveSignupScreen(atConsents, 'account')).toEqual({ allowed: false, redirectTo: 'consents' });
    expect(resolveSignupScreen(atBirthdate, 'account')).toEqual({ allowed: false, redirectTo: 'birthdate' });
  });

  it('retour arrière autorisé vers les étapes déjà franchies', () => {
    expect(resolveSignupScreen(atAccount, 'birthdate')).toEqual({ allowed: true });
    expect(resolveSignupScreen(atAccount, 'consents')).toEqual({ allowed: true });
  });

  it('S64 inaccessible sans refus', () => {
    expect(resolveSignupScreen(atBirthdate, 'refused')).toEqual({ allowed: false, redirectTo: 'birthdate' });
  });

  it('après un refus : seul S64 est accessible', () => {
    expect(resolveSignupScreen(refused, 'refused')).toEqual({ allowed: true });
    for (const screen of ['consents', 'birthdate', 'account'] as const) {
      expect(resolveSignupScreen(refused, screen)).toEqual({ allowed: false, redirectTo: 'refused' });
    }
  });
});

describe('garde d\'authentification', () => {
  const out = { status: 'signedOut', onboardingPending: false } as const;
  const inDone = { status: 'signedIn', onboardingPending: false } as const;
  const inOnboarding = { status: 'signedIn', onboardingPending: true } as const;
  const loading = { status: 'loading', onboardingPending: false } as const;

  it('attend pendant la restauration du jeton', () => {
    for (const area of ['public', 'onboarding', 'app'] as const) {
      expect(guardArea(loading, area)).toEqual({ kind: 'wait' });
    }
  });

  it('visiteur : zone publique seulement, le reste renvoie à S01', () => {
    expect(guardArea(out, 'public')).toEqual({ kind: 'allow' });
    expect(guardArea(out, 'app')).toEqual({ kind: 'redirect', href: ROUTES.welcome });
    expect(guardArea(out, 'onboarding')).toEqual({ kind: 'redirect', href: ROUTES.welcome });
  });

  it('connecté : la zone publique renvoie à l\'accueil connecté', () => {
    expect(guardArea(inDone, 'public')).toEqual({ kind: 'redirect', href: ROUTES.home });
    expect(guardArea(inDone, 'app')).toEqual({ kind: 'allow' });
    expect(guardArea(inDone, 'onboarding')).toEqual({ kind: 'redirect', href: ROUTES.home });
  });

  it('nouveau compte : onboarding obligatoire avant l\'accueil', () => {
    expect(signedInHome(inOnboarding)).toBe(ROUTES.onboardingStart);
    expect(guardArea(inOnboarding, 'onboarding')).toEqual({ kind: 'allow' });
    expect(guardArea(inOnboarding, 'app')).toEqual({ kind: 'redirect', href: ROUTES.onboardingStart });
    expect(guardArea(inOnboarding, 'public')).toEqual({ kind: 'redirect', href: ROUTES.onboardingStart });
  });
});

describe('état d\'authentification', () => {
  const user = { id: 'u', email: 'a@b.fr', locale: 'fr' as const };

  it('restauration sans jeton -> signedOut ; avec jeton -> signedIn', () => {
    expect(authReducer(initialAuthState, { type: 'RESTORED', signedIn: false, user: null, onboardingPending: true }).status).toBe('signedOut');
    const s = authReducer(initialAuthState, { type: 'RESTORED', signedIn: true, user, onboardingPending: true });
    expect(s).toEqual({ status: 'signedIn', user, onboardingPending: true });
  });

  it('inscription : onboarding en attente ; connexion : non (F00)', () => {
    expect(authReducer(initialAuthState, { type: 'SIGNED_IN', user, isNewAccount: true }).onboardingPending).toBe(true);
    expect(authReducer(initialAuthState, { type: 'SIGNED_IN', user, isNewAccount: false }).onboardingPending).toBe(false);
  });

  it('fin d\'onboarding et déconnexion', () => {
    const s = authReducer(initialAuthState, { type: 'SIGNED_IN', user, isNewAccount: true });
    expect(authReducer(s, { type: 'ONBOARDING_DONE' }).onboardingPending).toBe(false);
    expect(authReducer(s, { type: 'SIGNED_OUT' })).toEqual({ status: 'signedOut', user: null, onboardingPending: false });
  });
});

describe('validation des saisies', () => {
  it('e-mail', () => {
    expect(validateEmail('')).toBe('validation.email.required');
    expect(validateEmail('abc')).toBe('validation.email.invalid');
    expect(validateEmail(' a@b.fr ')).toBeNull();
  });

  it('mot de passe : inscription >= 10, lettres et chiffres ; connexion : non vide', () => {
    expect(validatePassword('', 'login')).toBe('validation.password.required');
    expect(validatePassword('court', 'login')).toBeNull();
    expect(validatePassword('court1', 'register')).toBe('validation.password.weak');
    expect(validatePassword('uniquementlettres', 'register')).toBe('validation.password.weak');
    expect(validatePassword('1234567890123', 'register')).toBe('validation.password.weak');
    expect(validatePassword('Motdepasse123', 'register')).toBeNull();
  });

  const today = new Date(2026, 10, 5); // 5 novembre 2026
  it('date de naissance : ISO, dates inexistantes, futur ; ne décide jamais de l\'âge', () => {
    expect(toIsoBirthdate({ day: 7, month: 3, year: 1990 }, today)).toEqual({ ok: true, iso: '1990-03-07' });
    expect(toIsoBirthdate({ day: 31, month: 2, year: 1990 }, today)).toEqual({ ok: false, error: 'invalid' });
    expect(toIsoBirthdate({ day: 29, month: 2, year: 2001 }, today)).toEqual({ ok: false, error: 'invalid' });
    expect(toIsoBirthdate({ day: 29, month: 2, year: 2000 }, today)).toEqual({ ok: true, iso: '2000-02-29' });
    expect(toIsoBirthdate({ day: 5, month: 11, year: 2026 }, today)).toEqual({ ok: false, error: 'future' });
    expect(toIsoBirthdate({ day: 1, month: 1 }, today)).toEqual({ ok: false, error: 'incomplete' });
    // Une date de mineur reste « ok » côté client : c'est le serveur qui refuse et mémorise (403 age_not_eligible).
    expect(toIsoBirthdate({ day: 1, month: 1, year: 2015 }, today)).toEqual({ ok: true, iso: '2015-01-01' });
  });
});

describe('conformité aux règles d\'architecture', () => {
  const root = path.resolve(__dirname, '..');
  const files = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = path.join(dir, e.name);
      return e.isDirectory() ? files(full) : /\.(ts|tsx)$/.test(e.name) ? [full] : [];
    });

  it('AsyncStorage n\'est jamais utilisé (jeton : expo-secure-store uniquement)', () => {
    const offenders = [...files(path.join(root, 'src')), ...files(path.join(root, 'app'))].filter((f) =>
      /(?:from|require\()\s*['"][^'"]*async-storage/.test(fs.readFileSync(f, 'utf8')),
    );
    expect(offenders).toEqual([]);
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
    };
    expect(Object.keys(pkg.dependencies)).not.toContain('@react-native-async-storage/async-storage');
  });

  it('aucune URL de serveur en dur dans le code applicatif', () => {
    // Exception : les pages publiques « Abonnements » des boutiques (App Store / Google Play), qui ne sont pas notre serveur.
    const storePages = path.join('src', 'features', 'premium', 'ManageSubscription.tsx');
    const offenders = [...files(path.join(root, 'src')), ...files(path.join(root, 'app'))]
      .filter((f) => !f.endsWith(storePages))
      .filter((f) => /https?:\/\/(?!docs\.expo)/.test(fs.readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
