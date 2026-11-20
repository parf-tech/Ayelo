import { act, screen, userEvent } from '@testing-library/react-native';
import fs from 'fs';
import path from 'path';
import React from 'react';
import { Text } from 'react-native';
import { BiometricGate } from '../src/security/BiometricGate';
import { BiometricLockContext, type BiometricLockValue } from '../src/security/BiometricLockProvider';
import { renderThemed } from './helpers/render';

const mockSignOut = jest.fn(async () => undefined);
jest.mock('../src/auth/AuthProvider', () => ({ useAuth: () => ({ signOut: mockSignOut, state: { status: 'signedIn' } }) }));

function fake(over: Partial<BiometricLockValue> = {}): BiometricLockValue {
  return {
    ready: true,
    supported: true,
    enabled: true,
    locked: false,
    setEnabled: jest.fn(async () => 'ok'),
    unlock: jest.fn(async () => true),
    confirm: jest.fn(async () => true),
    ...over,
  };
}

async function show(value: BiometricLockValue, locale: 'fr' | 'en' = 'fr') {
  await renderThemed(
    <BiometricLockContext.Provider value={value}>
      <BiometricGate>
        <Text>Contenu privé</Text>
      </BiometricGate>
    </BiometricLockContext.Provider>,
    { locale },
  );
}

beforeEach(() => jest.clearAllMocks());

describe('écran de verrouillage', () => {
  it('déverrouillé : le contenu s’affiche, aucun écran de verrouillage', async () => {
    await show(fake());
    expect(screen.getByText('Contenu privé')).toBeOnTheScreen();
    expect(screen.queryByTestId('lock-screen')).toBeNull();
    expect(screen.getByTestId('lock-content').props.accessibilityElementsHidden).toBeFalsy();
  });

  it('verrouillé : l’écran couvre le contenu, qui reste monté mais caché au lecteur d’écran', async () => {
    await show(fake({ locked: true }));
    expect(screen.getByTestId('lock-screen')).toBeOnTheScreen();
    expect(screen.getByText('Ayelo est verrouillé')).toBeOnTheScreen();
    expect(screen.getByTestId('lock-screen').props.accessibilityViewIsModal).toBe(true);
    // Monté (l'état des écrans et la navigation ne sont pas perdus), mais jamais lu ni focalisable.
    const content = screen.getByTestId('lock-content', { includeHiddenElements: true });
    expect(content.props.accessibilityElementsHidden).toBe(true);
    expect(content.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(screen.getByText('Contenu privé', { includeHiddenElements: true })).toBeTruthy();
  });

  it('« Déverrouiller » relance l’invite', async () => {
    const value = fake({ locked: true });
    await show(value);
    await userEvent.setup().press(screen.getByTestId('lock-unlock'));
    expect(value.unlock).toHaveBeenCalledTimes(1);
  });

  it('« Se déconnecter » reste possible : une biométrie qui échoue ne bloque pas définitivement', async () => {
    await show(fake({ locked: true }));
    await act(async () => {
      await userEvent.setup().press(screen.getByTestId('lock-signout'));
    });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('en anglais', async () => {
    await show(fake({ locked: true }), 'en');
    expect(screen.getByText('Ayelo is locked')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Unlock' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeOnTheScreen();
  });
});

describe('montage dans la mise en page racine', () => {
  it('app/_layout.tsx monte le fournisseur sous la session et la barrière autour de la navigation', () => {
    const layout = fs.readFileSync(path.join(__dirname, '..', 'app', '_layout.tsx'), 'utf8');
    expect(layout).toMatch(/<AuthProvider>[\s\S]*<BiometricLockProvider>/);
    expect(layout).toMatch(/<BiometricGate>\s*<ThemedNavigation>\s*<Slot \/>\s*<\/ThemedNavigation>\s*<\/BiometricGate>/);
  });
});
