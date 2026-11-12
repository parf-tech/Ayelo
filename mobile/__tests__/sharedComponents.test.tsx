import { screen, userEvent } from '@testing-library/react-native';
import React from 'react';
import { borderWidth, colors, radius, space, stateOpacity } from '../src/theme';
import { Avatar, ListRow, VerifiedBadge } from '../src/ui';
import { flatStyle as flat, renderThemed } from './helpers/render';

describe('ListRow : carte arrondie avec chevron', () => {
  it('ligne cliquable : carte (rayon, surface, bordure), hauteur >= 56, chevron Icon masqué, un seul bouton', async () => {
    await renderThemed(<ListRow testID="row" label="Langue" description="Choisir" value="Français" onPress={jest.fn()} />);
    const style = flat(screen.getByTestId('row').props.style);
    expect(style.borderRadius).toBe(radius.md);
    expect(style.backgroundColor).toBe(colors.light.surface);
    expect(style.borderColor).toBe(colors.light.border);
    expect(style.borderWidth).toBe(borderWidth.hairline);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Langue. Choisir' })).toBeOnTheScreen();
    expect(screen.getByTestId('row-chevron', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId('row-chevron')).toBeNull(); // masqué de l'arbre d'accessibilité
    expect(screen.queryByText('›')).toBeNull();
  });

  it('hauteur minimale 56 sur la ligne', async () => {
    await renderThemed(<ListRow testID="row" label="Langue" onPress={jest.fn()} />);
    const inner = screen.getByTestId('row').children[0] as unknown as { props: { style: unknown } };
    expect(Number(flat(inner.props.style).minHeight)).toBeGreaterThanOrEqual(56);
  });

  it('état appuyé : opacité stateOpacity.pressed ; onPress est appelé', async () => {
    const onPress = jest.fn();
    await renderThemed(<ListRow testID="row" label="Langue" onPress={onPress} />);
    await userEvent.setup().press(screen.getByTestId('row'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(stateOpacity.pressed).toBeLessThan(1);
  });

  it('ligne statique : carte sans chevron, sans rôle bouton', async () => {
    await renderThemed(<ListRow testID="row" label="Version" value="1.0" accessibilityLabel="Version 1.0" />);
    expect(flat(screen.getByTestId('row').props.style).borderRadius).toBe(radius.md);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByTestId('row-chevron', { includeHiddenElements: true })).toBeNull();
  });

  it('ton danger conserve la couleur danger du libellé', async () => {
    await renderThemed(<ListRow label="Supprimer" tone="danger" onPress={jest.fn()} />);
    expect(flat(screen.getByText('Supprimer').props.style).color).toBe(colors.light.danger);
  });
});

describe('VerifiedBadge : icône BadgeCheck', () => {
  const props = { label: 'Profil vérifié', explanation: 'Explication.', hint: 'Touchez.' };

  it('affiche l’icône BadgeCheck (masquée) sans coche texte ; couleur verified ; libellé et état conservés', async () => {
    await renderThemed(<VerifiedBadge {...props} testID="vb" />);
    expect(screen.queryByText(/✓/)).toBeNull();
    expect(screen.getByTestId('vb-icon', { includeHiddenElements: true })).toBeTruthy();
    expect(flat(screen.getByText('Profil vérifié').props.style).color).toBe(colors.light.verified);
    const badge = screen.getByRole('button', { name: 'Profil vérifié' });
    expect(badge).toBeCollapsed();
    expect(badge.props.accessibilityHint).toBe('Touchez.');
  });

  it('un toucher déplie l’explication', async () => {
    await renderThemed(<VerifiedBadge {...props} testID="vb" />);
    await userEvent.setup().press(screen.getByRole('button', { name: 'Profil vérifié' }));
    expect(screen.getByTestId('vb-explanation')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Profil vérifié' })).toBeExpanded();
  });
});

describe('Avatar : anneau facultatif', () => {
  it('sans ring : rendu inchangé (pas d’anneau, taille déclarée)', async () => {
    await renderThemed(<Avatar name="Awa" size={48} testID="av" />);
    expect(screen.queryByTestId('av-ring')).toBeNull();
    const s = flat(screen.getByTestId('av').props.style);
    expect([s.width, s.height]).toEqual([48, 48]);
  });

  it('ring={false} équivaut à l’absence d’anneau', async () => {
    await renderThemed(<Avatar name="Awa" size={48} ring={false} testID="av" />);
    expect(screen.queryByTestId('av-ring')).toBeNull();
  });

  it.each([
    [true, 'primary'],
    ['story', 'primary'],
    ['verified', 'verified'],
  ] as const)('ring=%s : contour couleur %s, largeur strong, taille extérieure inchangée', async (ring, token) => {
    await renderThemed(<Avatar name="Awa" size={64} ring={ring} testID="av" />);
    const outer = flat(screen.getByTestId('av-ring').props.style);
    expect(outer.borderColor).toBe(colors.light[token]);
    expect(outer.borderWidth).toBe(borderWidth.strong);
    expect([outer.width, outer.height]).toEqual([64, 64]);
    const inner = flat(screen.getByTestId('av').props.style);
    const inset = borderWidth.strong + space[1];
    expect([inner.width, inner.height]).toEqual([64 - 2 * inset, 64 - 2 * inset]);
  });

  it('avec photo et anneau : l’image reste décorative', async () => {
    await renderThemed(<Avatar name="Awa" uri="https://example.test/a.jpg" ring="verified" testID="av" />);
    expect(screen.getByTestId('av-ring')).toBeTruthy();
    expect(screen.getByTestId('av').props.accessible).toBe(false);
  });
});
