import { act, fireEvent, screen, userEvent, waitFor, within } from '@testing-library/react-native';
import React from 'react';
import { AccessibilityInfo, Platform, Pressable, View } from 'react-native';
import { AuthFormScreen } from '../src/features/auth/AuthFormScreen';
import { ResetPasswordScreen } from '../src/features/auth/ResetPasswordScreen';
import { VerifyEmailScreen } from '../src/features/emailVerification/VerifyEmailScreen';
import { MenuItem } from '../src/features/common/MenuItem';
import { ConfirmPanel } from '../src/features/settings/ConfirmPanel';
import { I18nProvider } from '../src/i18n';
import { ThemeProvider } from '../src/theme';
import { Announce, AsyncView, Avatar, Banner, SwitchRow } from '../src/ui';
import { resetAnnounceDebounce } from '../src/ui/a11y/announce';
import { spyAnnounce } from './helpers/a11y';
import { renderApp } from './helpers/app';
import { emptyBody, installFakeApi } from './helpers/fakeApi';
import { flatStyle as flat, renderThemed } from './helpers/render';
import { resetRouterMocks } from './helpers/routerMock';

// Revue design, lot 6 : constats des relectures de deuxième passe.

jest.mock('expo-router', () => ({
  ...require('./helpers/routerMock').expoRouterMock,
  useLocalSearchParams: jest.fn(() => ({})),
}));

const originalOS = Platform.OS;
function setOS(os: 'ios' | 'android') {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
}
const user = () => userEvent.setup();

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  resetRouterMocks();
  resetAnnounceDebounce();
});

afterEach(async () => {
  jest.restoreAllMocks();
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => originalOS });
  await act(async () => undefined);
});

describe('Banner : l’action passe sous le message', () => {
  it('message et action partagent une même colonne (flex 1) : une action longue n’écrase pas le texte', async () => {
    await renderThemed(
      <Banner
        variant="warning"
        message="Texte du message"
        actionLabel="Voir les offres Premium"
        onAction={() => undefined}
        onDismiss={() => undefined}
        dismissLabel="Fermer"
      />,
    );
    const column = screen.getByText('Texte du message').parent!;
    expect(flat(column.props.style).flex).toBe(1);
    expect(within(column).getByRole('button', { name: 'Voir les offres Premium' })).toBeOnTheScreen();
  });

  it('announceOnShow={false} : aucune annonce (le focus est déplacé par l’appelant)', async () => {
    setOS('ios');
    const announce = spyAnnounce();
    await renderThemed(<Banner variant="warning" message="Attention" announceOnShow={false} />);
    expect(announce).not.toHaveBeenCalled();
  });
});

describe('ConfirmPanel : pas de double lecture', () => {
  it('le message n’est pas annoncé en plus du déplacement du focus', async () => {
    setOS('ios');
    const announce = spyAnnounce();
    await renderThemed(<ConfirmPanel message="Cette action est définitive." onConfirm={() => undefined} onCancel={() => undefined} />);
    expect(announce).not.toHaveBeenCalled();
  });

  it('rend le focus à l’élément déclencheur à la fermeture', async () => {
    const setFocus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus').mockImplementation(() => undefined);
    // Le moteur de test n'a pas de vue native : on donne un identifiant de nœud à toute référence.
    jest.spyOn(require('react-native'), 'findNodeHandle').mockReturnValue(7);
    const trigger = React.createRef<React.ComponentRef<typeof Pressable>>();
    function Host({ open }: { open: boolean }) {
      return (
        <>
          <Pressable ref={trigger} accessible testID="trigger" />
          {open ? <ConfirmPanel message="Confirmer ?" onConfirm={() => undefined} onCancel={() => undefined} returnFocusRef={trigger} /> : null}
        </>
      );
    }
    const { rerender } = await renderThemed(<Host open />);
    setFocus.mockClear();
    await act(async () => {
      rerender(<Host open={false} />);
    });
    expect(setFocus).toHaveBeenCalled();
  });
});

describe('AsyncView : l’erreur est lue sur Android', () => {
  it('région vivante polie et rôle alerte sur l’état d’erreur', async () => {
    await renderThemed(
      <AsyncView testID="liste" status="error" error={new Error('x')} onRetry={() => undefined}>
        <View />
      </AsyncView>,
    );
    const error = screen.getByTestId('liste-error');
    expect(error.props.accessibilityLiveRegion).toBe('polite');
    expect(error.props.accessibilityRole).toBe('alert');
  });

  it('chargement : le parent porte « Chargement », les briques sont masquées', async () => {
    await renderThemed(
      <AsyncView testID="liste" status="loading">
        <View />
      </AsyncView>,
    );
    expect(screen.getByTestId('liste-loading').props.accessibilityLabel).toBe('Chargement');
    const brick = screen.getAllByTestId('skeleton', { includeHiddenElements: true })[0]!;
    expect(brick.parent!.props.importantForAccessibility).toBe('no-hide-descendants');
  });
});

describe('Composants partagés', () => {
  it('SwitchRow : la ligne ne prend pas le focus clavier (l’interrupteur le porte)', async () => {
    await renderThemed(<SwitchRow label="Alertes" value={false} onValueChange={() => undefined} testID="sw" />);
    expect(screen.getByTestId('sw-row').props.focusable).toBe(false);
  });

  it('Avatar de repli : l’initiale est masquée aux lecteurs d’écran', async () => {
    await renderThemed(<Avatar name="Awa" testID="av" />);
    const fallback = screen.getByTestId('av', { includeHiddenElements: true });
    expect(fallback.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(fallback.props.accessibilityElementsHidden).toBe(true);
  });

  it('MenuItem : anneau de focus visible au clavier', async () => {
    await renderThemed(<MenuItem testID="mi" icon="Flag" label="Signaler" onPress={() => undefined} />);
    const item = screen.getByTestId('mi');
    expect(flat(item.props.style).outlineWidth).toBeUndefined();
    await fireEvent(item, 'focus');
    expect(Number(flat(screen.getByTestId('mi').props.style).outlineWidth)).toBeGreaterThan(0);
  });

  it('Announce : annonce chaque changement de message (iOS), pas le premier rendu avec skipInitial', async () => {
    setOS('ios');
    const announce = spyAnnounce();
    const { rerender } = await renderThemed(<Announce message="Âge minimum : 25" skipInitial />);
    expect(announce).not.toHaveBeenCalled();
    // Même arbre (mêmes fournisseurs) : le composant n'est pas remonté, seul le message change.
    await act(async () => {
      rerender(
        <ThemeProvider scheme="light">
          <I18nProvider initialLocale="fr">
            <Announce message="Âge minimum : 26" skipInitial />
          </I18nProvider>
        </ThemeProvider>,
      );
    });
    expect(announce).toHaveBeenCalledWith('Âge minimum : 26');
  });
});

describe('Connexion et vérification d’e-mail', () => {
  it('422 sur un champ : le message est sous le champ, sans bandeau qui le répète', async () => {
    installFakeApi({
      'POST /auth/login': [422, { error: { code: 'validation_failed', message: 'x', fields: { email: ['invalid'] } } }],
    });
    await renderApp(<AuthFormScreen mode="login" />);
    const u = user();
    await u.type(screen.getByTestId('auth-email'), 'pas-un-email');
    await u.type(screen.getByTestId('auth-password'), 'Motdepasse2026');
    await u.press(screen.getByTestId('auth-submit'));
    await waitFor(() => expect(screen.getByTestId('auth-submit')).toBeEnabled());
    expect(screen.queryByTestId('auth-banner')).toBeNull();
  });

  it('« J’ai confirmé » sans confirmation : le résultat « pas encore confirmé » est annoncé (iOS)', async () => {
    setOS('ios');
    const announce = spyAnnounce();
    installFakeApi({ 'GET /me': [200, { id: 'u1', email: 'awa@example.test', email_verified: false, locale: 'fr', profile: null }] } as never);
    await renderApp(<VerifyEmailScreen />);
    await user().press(screen.getByTestId('verify-check'));
    await screen.findByTestId('verify-banner');
    await waitFor(() => expect(announce).toHaveBeenCalledWith(expect.stringMatching(/pas encore/i)));
  });

  it('nouveau mot de passe enregistré : plus de bouton retour vers un formulaire périmé', async () => {
    installFakeApi({ 'POST /auth/password/reset': emptyBody() });
    await renderApp(<ResetPasswordScreen />);
    expect(screen.getByTestId('back-button')).toBeOnTheScreen();
    const u = user();
    await u.type(screen.getByTestId('reset-token'), 'jeton-recu');
    await u.type(screen.getByTestId('reset-password'), 'Motdepasse2026');
    await u.type(screen.getByTestId('reset-confirm'), 'Motdepasse2026');
    await u.press(screen.getByTestId('reset-submit'));
    await waitFor(() => expect(screen.queryByTestId('back-button')).toBeNull());
  });
});
