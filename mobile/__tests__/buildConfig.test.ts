import fs from 'fs';
import path from 'path';
import { colors } from '../src/theme';
import { buildNavigationTheme } from '../src/theme/navigationTheme';
import { monthlyPrice, periodToMonths } from '../src/features/premium/pricing';

const root = path.join(__dirname, '..');
const readJson = (file: string) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
// Script CommonJS de build, exécuté aussi par EAS : on le charge tel quel.
const { checkEnv, main } = require('../scripts/check-env.js') as {
  checkEnv: (env: Record<string, string | undefined>, o: { production: boolean }) => { errors: string[]; warnings: string[] };
  main: (argv: string[], env: Record<string, string | undefined>) => number;
};

const FULL = {
  EXPO_PUBLIC_API_URL: 'https://api.example.test',
  EXPO_PUBLIC_TERMS_URL: 'https://example.test/cgu',
  EXPO_PUBLIC_PRIVACY_URL: 'https://example.test/confidentialite',
};

describe('check:env (build de production)', () => {
  it('production : échoue si l\'API ou un texte légal manque, sans afficher aucune valeur', () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      expect(main([], { EAS_BUILD_PROFILE: 'production', ...FULL, EXPO_PUBLIC_TERMS_URL: '  ' })).toBe(1);
      expect(main([], { EAS_BUILD_PROFILE: 'production', ...FULL, EXPO_PUBLIC_PRIVACY_URL: undefined })).toBe(1);
      expect(main([], { EAS_BUILD_PROFILE: 'production', ...FULL, EXPO_PUBLIC_API_URL: undefined })).toBe(1);
      const printed = error.mock.calls.flat().join('\n');
      expect(printed).toContain('EXPO_PUBLIC_TERMS_URL');
      expect(printed).toContain('EXPO_PUBLIC_PRIVACY_URL');
      expect(printed).toContain('EXPO_PUBLIC_API_URL');
      expect(printed).not.toContain('example.test');
    } finally {
      error.mockRestore();
      warn.mockRestore();
    }
  });

  it('production : refuse une adresse non https (API ou textes légaux)', () => {
    const r = checkEnv({ ...FULL, EXPO_PUBLIC_API_URL: 'http://api.example.test' }, { production: true });
    expect(r.errors).toEqual(['EXPO_PUBLIC_API_URL doit être une adresse https://']);
    expect(checkEnv({ ...FULL, EXPO_PUBLIC_TERMS_URL: 'ftp://x.test/cgu' }, { production: true }).errors).toHaveLength(1);
  });

  it('production complète : réussit (les variables facultatives donnent des avertissements seulement)', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const write = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      expect(main([], { EAS_BUILD_PROFILE: 'production', ...FULL })).toBe(0);
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
      write.mockRestore();
    }
  });

  it('hors production (développement, aperçu, poste local) : jamais bloquant', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const write = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      expect(main([], { EAS_BUILD_PROFILE: 'preview' })).toBe(0);
      expect(main([], {})).toBe(0);
      expect(main(['--strict'], {})).toBe(1);
    } finally {
      warn.mockRestore();
      write.mockRestore();
    }
  });

  it('les variables exigées sont celles que l\'application lit réellement', () => {
    const { REQUIRED } = require('../scripts/check-env.js') as { REQUIRED: string[] };
    const env = fs.readFileSync(path.join(root, 'src', 'config', 'env.ts'), 'utf8');
    for (const name of REQUIRED) expect(env).toContain(name);
  });

  it('branché : `npm run check:env` et le crochet EAS `eas-build-pre-install` exécutent le script ; le profil production existe', () => {
    const pkg = readJson('package.json') as { scripts: Record<string, string> };
    expect(pkg.scripts['check:env']).toBe('node scripts/check-env.js');
    expect(pkg.scripts['eas-build-pre-install']).toBe('node scripts/check-env.js');
    expect(readJson('eas.json').build.production.environment).toBe('production');
  });
});

describe('thème de navigation et écran de démarrage (sans flash blanc)', () => {
  it.each(['light', 'dark'] as const)('thème React Navigation %s : fond, texte, bordure issus des jetons', (scheme) => {
    const theme = buildNavigationTheme(scheme);
    expect(theme.dark).toBe(scheme === 'dark');
    expect(theme.colors).toMatchObject({
      background: colors[scheme].bg,
      card: colors[scheme].bg,
      text: colors[scheme].text,
      border: colors[scheme].border,
      primary: colors[scheme].primary,
    });
    expect(theme.fonts).toBeDefined();
  });

  it('la racine enveloppe l\'application dans le ThemeProvider de React Navigation', () => {
    const layout = fs.readFileSync(path.join(root, 'app', '_layout.tsx'), 'utf8');
    expect(layout).toMatch(/ThemeProvider as NavigationThemeProvider/);
    expect(layout).toMatch(/<NavigationThemeProvider value=\{value\}>/);
    expect(layout).toMatch(/<ThemedNavigation>\s*<Slot \/>\s*<\/ThemedNavigation>/);
  });

  it('app.json : écran de démarrage clair et sombre sur la couleur de fond des jetons', () => {
    const plugins = readJson('app.json').expo.plugins as unknown[];
    const splash = plugins.find((p) => Array.isArray(p) && p[0] === 'expo-splash-screen') as [string, { backgroundColor: string; dark: { backgroundColor: string } }];
    expect(splash).toBeDefined();
    expect(splash[1].backgroundColor.toLowerCase()).toBe(colors.light.bg.toLowerCase());
    expect(splash[1].dark.backgroundColor.toLowerCase()).toBe(colors.dark.bg.toLowerCase());
    // Aucune illustration inventée : le modèle d'Expo (assets/splash-icon.png) n'est pas la marque, donc pas d'image.
    expect(JSON.stringify(splash[1])).not.toMatch(/image/i);
  });

  it('expo-splash-screen est une dépendance déclarée', () => {
    expect(readJson('package.json').dependencies['expo-splash-screen']).toBeDefined();
  });
});

describe('permissions natives déclarées dans app.json', () => {
  const expo = readJson('app.json').expo;

  // Décision du propriétaire (2026-11-20) : le micro reste déclaré, pour les appels à venir (LiveKit), même si le code ne
  // l'ouvre pas encore. Les permissions sont donc là dès la première soumission ; la demande à l'utilisateur, elle, se fera
  // au moment de l'appel (FR-E-4).
  it('Android : caméra (selfie), micro (appels) et notifications sont déclarés, le micro n’est pas bloqué', () => {
    expect(expo.android.permissions).toEqual(
      expect.arrayContaining(['android.permission.CAMERA', 'android.permission.RECORD_AUDIO', 'android.permission.POST_NOTIFICATIONS']),
    );
    expect(expo.android.blockedPermissions).not.toContain('android.permission.RECORD_AUDIO');
  });

  it('iOS : les descriptions d’usage de la caméra, des photos et du micro sont renseignées (le micro explique les appels)', () => {
    const plist = expo.ios.infoPlist as Record<string, string>;
    expect(plist.NSCameraUsageDescription).toBeTruthy();
    expect(plist.NSPhotoLibraryUsageDescription).toBeTruthy();
    expect(plist.NSMicrophoneUsageDescription).toMatch(/micro/i);
    expect(plist.NSMicrophoneUsageDescription).toMatch(/appels/i);
  });

  it('le plugin du sélecteur d’images ne retire pas le micro : `microphonePermission: false` effacerait RECORD_AUDIO et la description iOS', () => {
    const picker = (expo.plugins as unknown[]).find((p) => Array.isArray(p) && p[0] === 'expo-image-picker') as [string, Record<string, unknown>];
    // expo-image-picker : `false` retire RECORD_AUDIO (Android) et NSMicrophoneUsageDescription (iOS) de la configuration native.
    expect(picker[1].microphonePermission).not.toBe(false);
    expect(picker[1].microphonePermission).toBe(expo.ios.infoPlist.NSMicrophoneUsageDescription);
    expect(picker[1].cameraPermission).toBeTruthy();
  });
});

describe('biométrie : description d’usage de Face ID', () => {
  const plugins = readJson('app.json').expo.plugins as unknown[];
  const options = (name: string) => (plugins.find((p) => Array.isArray(p) && p[0] === name) as [string, Record<string, unknown>] | undefined)?.[1];

  it('le plugin de l’authentification locale est déclaré, avec une description française de Face ID', () => {
    expect(readJson('package.json').dependencies['expo-local-authentication']).toBeDefined();
    const local = options('expo-local-authentication');
    expect(local).toBeDefined();
    expect(String(local?.faceIDPermission)).toMatch(/Face ID/);
    expect(String(local?.faceIDPermission)).not.toMatch(/Allow \$\(PRODUCT_NAME\)/);
  });

  it('expo-secure-store ne remet pas sa description anglaise par défaut : même texte que l’authentification locale', () => {
    expect(options('expo-secure-store')?.faceIDPermission).toBeTruthy();
    expect(options('expo-secure-store')?.faceIDPermission).toBe(options('expo-local-authentication')?.faceIDPermission);
  });
});

describe('prix par mois (offres de plusieurs mois)', () => {
  const product = (price: number, months: number, extra = {}) => ({
    productId: `p${months}`,
    title: 't',
    priceString: 'x',
    price,
    currencyCode: 'EUR',
    subscriptionPeriod: `P${months}M`,
    ...extra,
  });
  const nbsp = (s: string | null) => s?.replace(/[  ]/g, ' ');

  it('calcule en centimes entiers et formate selon la langue et la devise', () => {
    expect(nbsp(monthlyPrice(product(24.99, 3), 3, 'fr-FR'))).toBe('8,33 €');
    expect(nbsp(monthlyPrice(product(24.99, 3), 3, 'en-US'))).toMatch(/€8\.33/);
    expect(nbsp(monthlyPrice(product(59.99, 12), 12, 'fr-FR'))).toBe('5,00 €');
    expect(nbsp(monthlyPrice(product(0.3, 3), 3, 'en-US'))).toMatch(/€0\.10/); // pas de dérive flottante
  });

  it('devise sans décimales (JPY) : arrondi à l\'unité', () => {
    const jpy = product(3000, 3, { currencyCode: 'JPY' });
    expect(nbsp(monthlyPrice(jpy, 3, 'ja-JP'))).toMatch(/1,000/);
  });

  it('pas de ligne « par mois » : 1 mois, montant ou devise absents, durée incohérente avec la boutique', () => {
    expect(monthlyPrice(product(9.99, 1), 1, 'fr-FR')).toBeNull();
    expect(monthlyPrice(undefined, 3, 'fr-FR')).toBeNull();
    expect(monthlyPrice({ productId: 'p', title: 't', priceString: '24,99 €' }, 3, 'fr-FR')).toBeNull();
    expect(monthlyPrice(product(24.99, 3, { currencyCode: '' }), 3, 'fr-FR')).toBeNull();
    expect(monthlyPrice(product(0, 3), 3, 'fr-FR')).toBeNull();
    expect(monthlyPrice(product(24.99, 3, { subscriptionPeriod: 'P1M' }), 3, 'fr-FR')).toBeNull();
    expect(monthlyPrice(product(24.99, 3, { currencyCode: 'not-a-currency' }), 3, 'fr-FR')).toBeNull();
  });

  it('durée du store : P3M, P1Y, P52W lues ; valeurs inconnues refusées', () => {
    expect(periodToMonths('P1M')).toBe(1);
    expect(periodToMonths('P3M')).toBe(3);
    expect(periodToMonths('P1Y')).toBe(12);
    expect(periodToMonths('P52W')).toBe(12);
    expect(periodToMonths('P6W')).toBeNull();
    expect(periodToMonths('P0D')).toBeNull();
    expect(periodToMonths(null)).toBeNull();
    expect(periodToMonths('3 mois')).toBeNull();
  });

  it('période absente côté boutique : la durée du plan du serveur fait foi', () => {
    expect(nbsp(monthlyPrice(product(24.99, 3, { subscriptionPeriod: null }), 3, 'fr-FR'))).toBe('8,33 €');
  });
});
