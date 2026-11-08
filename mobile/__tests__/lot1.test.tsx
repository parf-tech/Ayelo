import { fireEvent, screen, userEvent } from '@testing-library/react-native';
import React from 'react';
import { AuthFormScreen } from '../src/features/auth/AuthFormScreen';
import { WelcomeScreen } from '../src/features/welcome/WelcomeScreen';
import { dictionaries } from '../src/i18n';
import { colors, MIN_TARGET } from '../src/theme';
import { EmptyState, SwitchRow, TextField, VerifiedBadge } from '../src/ui';
import { renderApp } from './helpers/app';
import { flatStyle as flat, renderThemed } from './helpers/render';
import { resetRouterMocks } from './helpers/routerMock';

jest.mock('expo-router', () => require('./helpers/routerMock').expoRouterMock);

const g = globalThis as unknown as { __DEV__: boolean };
const user = () => userEvent.setup();

beforeEach(() => resetRouterMocks());

describe('Lot 1 - 1 : lien composants réservé au développement', () => {
  const original = g.__DEV__;
  afterEach(() => {
    g.__DEV__ = original;
  });

  it('visible quand __DEV__ est vrai', async () => {
    g.__DEV__ = true;
    await renderApp(<WelcomeScreen />);
    expect(screen.getByRole('button', { name: 'Voir les composants (développement)' })).toBeOnTheScreen();
  });

  it('absent quand __DEV__ est faux (production)', async () => {
    g.__DEV__ = false;
    await renderApp(<WelcomeScreen />);
    expect(screen.queryByRole('button', { name: 'Voir les composants (développement)' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Créer un compte' })).toBeOnTheScreen();
  });
});

describe('Lot 1 - 3 : EmptyState', () => {
  it("le bouton d'action est atteignable par son rôle et appelle onAction ; titre et description restent lisibles", async () => {
    const onAction = jest.fn();
    await renderThemed(
      <EmptyState title="Rien ici" description="Revenez plus tard" actionLabel="Actualiser" onAction={onAction} testID="empty" />,
    );
    expect(screen.getByTestId('empty').props.accessible).not.toBe(true);
    expect(screen.getByText('Rien ici')).toBeOnTheScreen();
    expect(screen.getByText('Revenez plus tard')).toBeOnTheScreen();
    await user().press(screen.getByRole('button', { name: 'Actualiser' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});

describe('Lot 1 - 4 : badge vérifié', () => {
  const props = { label: 'Profil vérifié', explanation: 'Explication du badge.', hint: 'Touchez pour comprendre.' };

  it("utilise le jeton verified ; au toucher affiche l'explication ; état déplié annoncé", async () => {
    await renderThemed(<VerifiedBadge {...props} testID="vb" />);
    const badge = screen.getByRole('button', { name: 'Profil vérifié' });
    expect(badge).toBeCollapsed();
    expect(badge.props.accessibilityHint).toBe('Touchez pour comprendre.');
    expect(flat(screen.getByText('✓ Profil vérifié').props.style).color).toBe(colors.light.verified);
    expect(screen.queryByText('Explication du badge.')).toBeNull();
    await user().press(badge);
    expect(screen.getByText('Explication du badge.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Profil vérifié' })).toBeExpanded();
  });

  it('thème sombre : jeton verified sombre', async () => {
    await renderThemed(<VerifiedBadge {...props} />, { scheme: 'dark' });
    expect(flat(screen.getByText('✓ Profil vérifié').props.style).color).toBe(colors.dark.verified);
  });

  it('textes fr et en : phrase validée, plus de promesse « prouve »', () => {
    expect(dictionaries.fr['verified.explain']).toBe(
      'Ce badge confirme que votre selfie correspond à vos photos. Ce n’est pas une garantie d’identité.',
    );
    expect(dictionaries.en['verified.explain']).toMatch(/not a guarantee of identity/);
    for (const locale of ['fr', 'en'] as const) {
      const all = Object.values(dictionaries[locale]).join('\n');
      expect(all).not.toMatch(/prouve que vous|proves you are/);
    }
    expect(dictionaries.fr['verify.subtitle']).toContain('Ce n’est pas une garantie d’identité.');
  });
});

describe('Lot 1 - 5 : SwitchRow', () => {
  it('toute la ligne est la cible tactile (>= 44) ; un seul interrupteur exposé, sans texte dupliqué', async () => {
    const onValueChange = jest.fn();
    await renderThemed(
      <SwitchRow label="Notifications" description="Pour les messages" value={false} onValueChange={onValueChange} testID="sw" />,
    );
    expect(Number(flat(screen.getByTestId('sw-row').props.style).minHeight)).toBeGreaterThanOrEqual(MIN_TARGET);
    expect(screen.getAllByRole('switch')).toHaveLength(1);
    const sw = screen.getByRole('switch', { name: 'Notifications' });
    expect(sw.props.accessibilityHint).toBe('Pour les messages');
    expect(screen.queryByText('Notifications')).toBeNull();
    await user().press(screen.getByTestId('sw-row'));
    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it('désactivé : la ligne ne bascule pas', async () => {
    const onValueChange = jest.fn();
    await renderThemed(<SwitchRow label="Notifications" value disabled onValueChange={onValueChange} testID="sw" />);
    await user().press(screen.getByTestId('sw-row'));
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe("Lot 1 - 6 : refus d'âge", () => {
  it('« pour le moment » retiré en fr, « at this time » absent en en', () => {
    expect(dictionaries.fr['ageRefused.body']).not.toMatch(/pour le moment/);
    expect(dictionaries.en['ageRefused.body']).not.toMatch(/at this time|for now/);
  });
});

describe('Lot 1 - 7 : afficher le mot de passe', () => {
  const labels = { show: 'Afficher le mot de passe', hide: 'Masquer le mot de passe', showShort: 'Afficher', hideShort: 'Masquer' };

  it('texte visible court, libellé accessible complet, état sélectionné', async () => {
    await renderThemed(
      <TextField label="Mot de passe" value="x" onChangeText={jest.fn()} secureTextEntry passwordToggleLabels={labels} />,
    );
    const toggle = screen.getByRole('button', { name: 'Afficher le mot de passe' });
    expect(toggle).toHaveTextContent(/^Afficher$/);
    expect(toggle).not.toBeSelected();
    await user().press(toggle);
    const hide = screen.getByRole('button', { name: 'Masquer le mot de passe' });
    expect(hide).toHaveTextContent(/^Masquer$/);
    expect(hide).toBeSelected();
  });

  it('écran de connexion : bouton visible court', async () => {
    await renderApp(<AuthFormScreen mode="login" />);
    expect(screen.getByRole('button', { name: 'Afficher le mot de passe' })).toHaveTextContent(/^Afficher$/);
  });

  it('parité fr/en des nouvelles clés', () => {
    for (const k of ['ui.password.showShort', 'ui.password.hideShort', 'verified.explain', 'verified.hint'] as const) {
      expect(dictionaries.fr[k]).toBeTruthy();
      expect(dictionaries.en[k]).toBeTruthy();
    }
  });
});

describe('Lot 1 - 8 : enchaînement des champs', () => {
  it('e-mail (suivant) puis mot de passe (valider) ; valider sur le dernier champ lance le formulaire', async () => {
    await renderApp(<AuthFormScreen mode="login" />);
    const email = screen.getByTestId('auth-email');
    const password = screen.getByTestId('auth-password');
    expect(email.props.returnKeyType).toBe('next');
    expect(email.props.submitBehavior).toBe('submit');
    expect(password.props.returnKeyType).toBe('go');
    // Champs vides : la validation s'exécute et affiche les erreurs sous les champs.
    fireEvent(password, 'submitEditing');
    expect(await screen.findByTestId('auth-email-error')).toBeOnTheScreen();
  });
});
