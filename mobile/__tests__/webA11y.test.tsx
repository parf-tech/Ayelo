import { screen } from '@testing-library/react-native';
import React from 'react';
import { WelcomeBenefits } from '../src/features/welcome/WelcomeBenefits';
import { SwitchRow } from '../src/ui';
import { renderThemed } from './helpers/render';

// Défauts relevés par l'audit axe de la passe replica-test (e2e/a11y-largeur.spec.ts) sur l'aperçu web :
// - accueil : `aria-required-children` (liste dont les enfants ne sont pas des éléments de liste) ;
// - confidentialité : `aria-required-attr` et `nested-interactive` (interrupteur déclaré deux fois : conteneur et champ natif du web).

afterEach(() => jest.restoreAllMocks());

describe('Accueil : liste des engagements', () => {
  it('chaque engagement est un élément de liste', async () => {
    await renderThemed(<WelcomeBenefits />);
    expect(screen.getByTestId('welcome-benefits').props.accessibilityRole).toBe('list');
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });
});

describe('SwitchRow : un seul interrupteur exposé', () => {
  it('natif : l\'interrupteur garde son rôle et son état (lecteurs d\'écran)', async () => {
    await renderThemed(<SwitchRow label="Notifications" value onValueChange={jest.fn()} testID="sw" />);
    const sw = screen.getByTestId('sw');
    expect(sw.props.accessibilityRole).toBe('switch');
    expect(sw.props.accessibilityState).toMatchObject({ checked: true });
  });

  // Le rendu web (react-native-web) ne se reproduit pas dans Jest : le Switch de React Native y pose toujours son propre rôle.
  // La correction « web : ni rôle ni état sur le conteneur » est vérifiée par l'audit axe réel de e2e/a11y-largeur.spec.ts.
});
