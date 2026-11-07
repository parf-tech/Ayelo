import fs from 'fs';
import path from 'path';
import { ALLOWED_HTTPS_HOSTS, sanitizeIncomingUrl } from '../src/navigation/deepLinks';
import { redirectSystemPath } from '../app/+native-intent';

const prod = { dev: false };
const clean = (url: string) => sanitizeIncomingUrl(url, prod);
const CODE = 'a1b2c3d4-e5f6-4a7b-8c9d-0123456789ab.AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcd';

describe('liens profonds : liste blanche (revue P-12)', () => {
  it('accepte les routes prévues du schéma ayelo', () => {
    expect(clean('ayelo://')).toBe('/');
    expect(clean('ayelo://login')).toBe('/login');
    expect(clean('ayelo://forgot-password')).toBe('/forgot-password');
    expect(clean('ayelo://discover')).toBe('/discover');
    expect(clean('ayelo://messages')).toBe('/messages');
    expect(clean('ayelo:///profile')).toBe('/profile');
    expect(clean('AYELO://Discover'.replace('Discover', 'discover'))).toBe('/discover');
  });

  it('accepte un code à usage unique de réinitialisation ou de confirmation, sur sa route seulement', () => {
    expect(clean(`ayelo://reset-password?token=${CODE}`)).toBe(`/reset-password?token=${encodeURIComponent(CODE)}`);
    expect(clean(`ayelo://verify-email?token=${CODE}`)).toBe(`/verify-email?token=${encodeURIComponent(CODE)}`);
    // Sur une autre route le paramètre `token` est supprimé : aucun jeton ne circule dans l'URL vers un écran connecté.
    expect(clean(`ayelo://discover?token=${CODE}`)).toBe('/discover');
    expect(clean(`ayelo://login?token=${CODE}&access_token=${CODE}`)).toBe('/login');
  });

  it('refuse un code mal formé (trop court, caractères hors liste, injection)', () => {
    expect(clean('ayelo://reset-password?token=abc')).toBe('/reset-password');
    expect(clean('ayelo://reset-password?token=' + encodeURIComponent('<script>alert(1)</script>aaaaaaaaaaaa'))).toBe('/reset-password');
    expect(clean('ayelo://reset-password?token=' + 'a'.repeat(200))).toBe('/reset-password');
  });

  it('supprime les paramètres inconnus et garde le premier doublon seulement', () => {
    expect(clean(`ayelo://reset-password?x=1&token=${CODE}&token=${'b'.repeat(40)}&redirect=https://evil.test`)).toBe(
      `/reset-password?token=${encodeURIComponent(CODE)}`,
    );
    expect(clean('ayelo://login?redirect=https://evil.test&next=/settings/delete-account')).toBe('/login');
  });

  it('ne rend JAMAIS le faux écran de match ni les écrans sensibles (la photo et le nom d\'un lien sont ignorés)', () => {
    expect(clean('ayelo://match?name=Awa&photo=https://tracker.example/p.png&conversationId=abc12345')).toBeNull();
    for (const path of [
      '/match',
      '/call',
      '/report',
      '/filters',
      '/profile-edit',
      '/settings',
      '/settings/delete-account',
      '/settings/export',
      '/settings/sessions',
      '/premium',
      '/premium/result',
      '/premium/credits',
      '/verification',
      '/onboarding/photos',
      '/signup/account',
      '/signup/consents',
      '/signup/birthdate',
      '/signup/age-refused',
      '/components-demo',
      '/legal/terms',
    ]) {
      expect(clean(`ayelo://${path.slice(1)}`)).toBeNull();
      expect(clean(path)).toBeNull();
    }
  });

  it('conversation et profil : identifiant valide seulement, sans paramètres (nom, photo ignorés)', () => {
    const id = '0f8fad5b-d9cb-469f-a165-70867728950e';
    expect(clean(`ayelo://conversation/${id}`)).toBe(`/conversation/${id}`);
    expect(clean(`ayelo://conversation/${id}?name=Awa&photo=https://evil.test/p.png&peerId=${id}`)).toBe(`/conversation/${id}`);
    expect(clean(`ayelo://user/${id}`)).toBe(`/user/${id}`);
    expect(clean('ayelo://conversation/..%2Fsettings')).toBeNull();
    expect(clean('ayelo://conversation/x')).toBeNull();
    expect(clean('ayelo://conversation/')).toBeNull();
    expect(clean(`ayelo://conversation/${id}/extra`)).toBeNull();
  });

  it('refuse les schémas et hôtes non prévus', () => {
    expect(ALLOWED_HTTPS_HOSTS).toEqual([]); // liens universels non configurés : aucun lien HTTPS accepté
    for (const url of [
      'https://example.test/reset-password?token=' + CODE,
      'http://example.test/login',
      'javascript:alert(1)',
      'file:///etc/passwd',
      'intent://login#Intent;scheme=ayelo;end',
      'exp://127.0.0.1:8081/--/discover',
      'ayelo2://login',
      'evil+ayelo://login',
      'ayelo://user:pass@login',
      '//evil.test/login',
      '',
      'not a url',
    ]) {
      expect(clean(url)).toBeNull();
    }
  });

  it('refuse les astuces de chemin (.., doubles barres encodées, antislash, octet nul)', () => {
    expect(clean('ayelo://discover/../settings/export')).toBeNull();
    expect(clean('ayelo://login/%2e%2e/settings')).toBeNull();
    expect(clean('ayelo://login%00')).toBeNull();
    expect(clean('ayelo://login\\..\\settings')).toBeNull();
    expect(clean('/login%2Fsettings')).toBeNull();
    expect(clean('ayelo://' + 'a'.repeat(3000))).toBeNull();
  });

  it('tolère la barre finale et ignore le fragment', () => {
    expect(clean('ayelo://login/')).toBe('/login');
    expect(clean('ayelo://login#anything')).toBe('/login');
  });

  it('les liens du client de développement ne passent qu\'en développement', () => {
    expect(sanitizeIncomingUrl('exp://192.168.1.2:8081/--/login', { dev: true })).toBe('exp://192.168.1.2:8081/--/login');
    expect(sanitizeIncomingUrl('exp://192.168.1.2:8081/--/login', { dev: false })).toBeNull();
    expect(sanitizeIncomingUrl('ayelo://expo-development-client/?url=http%3A%2F%2F10.0.0.1%3A8081', { dev: true })).not.toBeNull();
    expect(sanitizeIncomingUrl('ayelo://expo-development-client/?url=http%3A%2F%2F10.0.0.1%3A8081', { dev: false })).toBeNull();
  });
});

describe('+native-intent : tous les liens entrants passent par la liste blanche', () => {
  it('redirectSystemPath renvoie le chemin nettoyé ou null (lien ignoré)', () => {
    expect(redirectSystemPath({ path: 'ayelo://match?photo=https://x.test/p.png', initial: true })).toBeNull();
    expect(redirectSystemPath({ path: 'ayelo://discover?photo=x', initial: false })).toBe('/discover');
  });

  it('le fichier existe à la racine de app/ (Expo Router le charge de là) et le schéma de app.json est ayelo', () => {
    const root = path.join(__dirname, '..');
    expect(fs.existsSync(path.join(root, 'app', '+native-intent.tsx'))).toBe(true);
    const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')) as { expo: { scheme: string; ios?: unknown; android?: { intentFilters?: unknown } } };
    expect(app.expo.scheme).toBe('ayelo');
  });
});
