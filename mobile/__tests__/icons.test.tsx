import { act, fireEvent, screen, userEvent } from '@testing-library/react-native';
import fs from 'fs';
import path from 'path';
import React from 'react';
import { borderWidth, colors, focus, iconSize, MIN_TARGET, stateOpacity } from '../src/theme';
import { Icon, IconButton } from '../src/ui';
import { ICON_NAMES, ICON_REGISTRY } from '../src/ui/icons';
import { flatStyle as flat, renderThemed } from './helpers/render';

/** Liste figée : table 4.3 de docs/design/03-composants.md (glyphes remplacés + icônes nouvelles) + ShieldCheck (section 3). */
const EXPECTED_ICONS = [
  // Table 4.3, glyphes remplacés
  'Heart', 'Layers', 'MessageCircle', 'User', 'Star', 'X', 'Trash2', 'CircleX', 'Check', 'BadgeCheck', 'CircleCheck',
  'CheckCheck', 'Clock', 'CircleAlert', 'TriangleAlert', 'Info', 'Phone', 'Video', 'Ellipsis', 'ChevronLeft',
  'ChevronRight', 'Minus', 'Plus',
  // Table 4.3, icônes nouvelles
  'SlidersHorizontal', 'Search', 'Eye', 'EyeOff', 'Send', 'Flag', 'Ban', 'ShieldAlert', 'MapPin', 'Globe', 'Undo2',
  'Lock', 'Sparkles', 'Camera', 'ImagePlus', 'Pencil', 'ChevronDown', 'Mic', 'MicOff', 'VideoOff', 'Volume2',
  'PhoneOff', 'SwitchCamera', 'Copy', 'WifiOff',
  // Section 3, liste de départ
  'ShieldCheck',
] as const;

describe('registre des icônes (AC-ICON-4)', () => {
  it('contient exactement la liste figée de la spec, sans entrée inutilisée', () => {
    expect([...ICON_NAMES].sort()).toEqual([...EXPECTED_ICONS].sort());
    expect(new Set(EXPECTED_ICONS).size).toBe(EXPECTED_ICONS.length);
  });

  it('chaque entrée est un composant', () => {
    for (const name of ICON_NAMES) {
      const glyph = ICON_REGISTRY[name] as unknown;
      expect(['function', 'object']).toContain(typeof glyph);
      expect(glyph).toBeTruthy();
    }
  });

  it.each(EXPECTED_ICONS)('%s : se rend sans erreur', async (name) => {
    await renderThemed(<Icon name={name} />);
    expect(screen.getByTestId(`icon-${name}`, { includeHiddenElements: true })).toBeTruthy();
  });
});

describe('Icon', () => {
  it('AC-ICON-1 : décorative par défaut, exclue de l\'arbre d\'accessibilité', async () => {
    await renderThemed(<Icon name="Heart" />);
    const node = screen.getByTestId('icon-Heart', { includeHiddenElements: true });
    expect(node.props.accessibilityElementsHidden).toBe(true);
    expect(node.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(node.props.accessible).toBe(false);
    expect(screen.queryByTestId('icon-Heart')).toBeNull();
    expect(screen.queryByRole('image')).toBeNull();
  });

  it('avec une étiquette : image accessible', async () => {
    await renderThemed(<Icon name="BadgeCheck" accessibilityLabel="Profil vérifié" />);
    const node = screen.getByRole('image', { name: 'Profil vérifié' });
    expect(node.props.accessibilityElementsHidden).toBeUndefined();
  });

  it.each(['sm', 'md', 'lg', 'xl'] as const)('AC-ICON-2 : taille %s lue dans iconSize', async (size) => {
    await renderThemed(<Icon name="Heart" size={size} />);
    const style = flat(screen.getByTestId('icon-Heart', { includeHiddenElements: true }).props.style);
    expect(style.width).toBe(iconSize[size]);
    expect(style.height).toBe(iconSize[size]);
  });

  it('taille md par défaut', async () => {
    await renderThemed(<Icon name="Heart" />);
    const style = flat(screen.getByTestId('icon-Heart', { includeHiddenElements: true }).props.style);
    expect(style.width).toBe(iconSize.md);
  });

  it.each(['light', 'dark'] as const)('AC-ICON-3 : couleur du jeton en thème %s', async (scheme) => {
    await renderThemed(<Icon name="Heart" tone="like" />, { scheme });
    const svg = screen.getByTestId('icon-Heart', { includeHiddenElements: true });
    const serialized = JSON.stringify(svg.children, (key, value) => (key === 'parent' ? undefined : value));
    expect(serialized.toLowerCase()).toContain(colors[scheme].like.toLowerCase());
  });

  it('remplit la forme quand filled, jamais sinon', async () => {
    const view = await renderThemed(<Icon name="Star" tone="primary" filled />);
    const filledJson = JSON.stringify(view.toJSON());
    expect(filledJson.toLowerCase()).toContain(`"fill":"${colors.light.primary.toLowerCase()}"`);
    await view.unmount();
    const plain = await renderThemed(<Icon name="Star" tone="primary" />);
    expect(JSON.stringify(plain.toJSON())).not.toContain(`"fill":"${colors.light.primary}"`);
  });

  it('trait issu des jetons', async () => {
    const view = await renderThemed(<Icon name="Heart" />);
    expect(JSON.stringify(view.toJSON())).toContain(`"strokeWidth":${borderWidth.strong}`);
  });

  it('nom inconnu : erreur explicite en développement', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(renderThemed(<Icon name={'Inconnue' as never} />)).rejects.toThrow(/inconnu/);
    spy.mockRestore();
  });

  it('une couleur hors jeton ne compile pas', () => {
    // @ts-expect-error tone doit être un rôle de couleur autorisé
    const element = <Icon name="Heart" tone="accent" />;
    expect(element).toBeTruthy();
  });
});

describe('IconButton', () => {
  it('AC-IBTN-1 : rôle bouton, nom accessible, cible >= 44 pt, sans hitSlop', async () => {
    const onPress = jest.fn();
    await renderThemed(<IconButton icon="X" accessibilityLabel="Fermer" onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Fermer' });
    const style = flat(button.props.style);
    expect(Number(style.minHeight)).toBeGreaterThanOrEqual(MIN_TARGET);
    expect(Number(style.minWidth)).toBeGreaterThanOrEqual(MIN_TARGET);
    expect(button.props.hitSlop).toBeUndefined();
    await userEvent.setup().press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('taille lg : cible de 48 pt et icône de 24 pt', async () => {
    await renderThemed(<IconButton icon="Heart" size="lg" accessibilityLabel="J'aime" onPress={jest.fn()} />);
    const button = screen.getByRole('button');
    const style = flat(button.props.style);
    expect(style.minHeight).toBe(MIN_TARGET + 4);
    expect(flat(screen.getByTestId('icon-button-Heart-icon', { includeHiddenElements: true }).props.style).width).toBe(
      iconSize.lg,
    );
  });

  it('icône décorative : seul le bouton porte le nom', async () => {
    await renderThemed(<IconButton icon="X" accessibilityLabel="Fermer" onPress={jest.fn()} />);
    expect(screen.queryByTestId('icon-button-X-icon')).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('appuyé : opacité du jeton', async () => {
    await renderThemed(<IconButton icon="X" accessibilityLabel="Fermer" onPress={jest.fn()} />);
    const event = { nativeEvent: { touches: [], changedTouches: [], timestamp: 0 }, persist: () => undefined };
    await fireEvent(screen.getByRole('button'), 'responderGrant', event);
    await act(async () => {});
    const style = flat(screen.getByRole('button').props.style);
    expect(style.opacity).toBe(stateOpacity.pressed);
  });

  it('AC-IBTN-2 : désactivé ignore l\'appui', async () => {
    const onPress = jest.fn();
    await renderThemed(<IconButton icon="X" accessibilityLabel="Fermer" onPress={onPress} disabled />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    await userEvent.setup().press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('désactivé : plain en opacité du jeton, filled en couleurs désactivées', async () => {
    const view = await renderThemed(<IconButton icon="X" accessibilityLabel="Fermer" onPress={jest.fn()} disabled />);
    expect(flat(screen.getByRole('button').props.style).opacity).toBe(stateOpacity.disabled);
    await view.unmount();
    await renderThemed(<IconButton icon="X" variant="filled" accessibilityLabel="Fermer" onPress={jest.fn()} disabled />);
    const style = flat(screen.getByRole('button').props.style);
    expect(style.backgroundColor).toBe(colors.light.disabledBg);
  });

  it('AC-IBTN-2 : chargement ignore l\'appui, expose busy, garde l\'étiquette', async () => {
    const onPress = jest.fn();
    await renderThemed(<IconButton icon="Send" accessibilityLabel="Envoyer" onPress={onPress} loading />);
    const button = screen.getByRole('button', { name: 'Envoyer' });
    expect(button).toBeBusy();
    expect(screen.getByTestId('icon-button-Send-spinner')).toBeTruthy();
    await userEvent.setup().press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('AC-IBTN-3 : selected et expanded exposés ; absents par défaut', async () => {
    const view = await renderThemed(<IconButton icon="Star" accessibilityLabel="Favori" onPress={jest.fn()} selected />);
    expect(screen.getByRole('button')).toBeSelected();
    expect(screen.getByRole('button').props.accessibilityState.selected).toBe(true);
    await view.unmount();
    await renderThemed(<IconButton icon="Ellipsis" accessibilityLabel="Plus d'actions" onPress={jest.fn()} expanded />);
    expect(screen.getByRole('button')).toBeExpanded();
    await act(async () => {});
  });

  it('variantes : couleurs de fond et d\'icône issues des jetons (clair et sombre)', async () => {
    for (const scheme of ['light', 'dark'] as const) {
      const filled = await renderThemed(
        <IconButton icon="Check" variant="filled" accessibilityLabel="Valider" onPress={jest.fn()} />,
        { scheme },
      );
      expect(flat(screen.getByRole('button').props.style).backgroundColor).toBe(colors[scheme].primary);
      expect(JSON.stringify(filled.toJSON()).toLowerCase()).toContain(colors[scheme].onPrimary.toLowerCase());
      await filled.unmount();
      const tonal = await renderThemed(
        <IconButton icon="Check" variant="tonal" accessibilityLabel="Valider" onPress={jest.fn()} />,
        { scheme },
      );
      const style = flat(screen.getByRole('button').props.style);
      expect(style.backgroundColor).toBe(colors[scheme].surface);
      expect(style.borderColor).toBe(colors[scheme].borderStrong);
      await tonal.unmount();
    }
  });

  it('AC-IBTN-4 : le focus dessine le contour du jeton, le blur le retire', async () => {
    await renderThemed(<IconButton icon="X" accessibilityLabel="Fermer" onPress={jest.fn()} />);
    const button = screen.getByRole('button');
    expect(flat(button.props.style).outlineWidth).toBeUndefined();
    await fireEvent(button, 'focus');
    const ring = flat(screen.getByRole('button').props.style);
    expect(ring.outlineWidth).toBe(focus.width);
    expect(ring.outlineOffset).toBe(focus.offset);
    expect(ring.outlineColor).toBe(colors.light.focusRing);
    await fireEvent(screen.getByRole('button'), 'blur');
    expect(flat(screen.getByRole('button').props.style).outlineWidth).toBeUndefined();
  });

  it('AC-IBTN-5 : le compteur du badge n\'est pas dupliqué dans l\'arbre, son texte est dans l\'étiquette', async () => {
    await renderThemed(
      <IconButton
        icon="SlidersHorizontal"
        accessibilityLabel="Filtres"
        onPress={jest.fn()}
        badge={{ kind: 'count', count: 3, accessibilityLabel: '3 filtres actifs' }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Filtres, 3 filtres actifs' })).toBeTruthy();
    expect(screen.queryByText('3')).toBeNull();
    const badge = screen.getByTestId('icon-button-SlidersHorizontal-badge', { includeHiddenElements: true });
    expect(badge.props.accessibilityElementsHidden).toBe(true);
    expect(screen.getByText('3', { includeHiddenElements: true })).toBeTruthy();
  });

  it('badge en point : aucun texte, plafond « 99+ » pour un compteur', async () => {
    const view = await renderThemed(
      <IconButton icon="Mic" accessibilityLabel="Micro" onPress={jest.fn()} badge={{ kind: 'dot' }} />,
    );
    expect(screen.getByTestId('icon-button-Mic-badge', { includeHiddenElements: true })).toBeTruthy();
    await view.unmount();
    await renderThemed(
      <IconButton
        icon="Mic"
        accessibilityLabel="Micro"
        onPress={jest.fn()}
        badge={{ kind: 'count', count: 250, accessibilityLabel: '250 notifications' }}
      />,
    );
    expect(screen.getByText('99+', { includeHiddenElements: true })).toBeTruthy();
  });

  it('testID personnalisé : les parties en dérivent', async () => {
    await renderThemed(
      <IconButton icon="X" accessibilityLabel="Fermer" onPress={jest.fn()} testID="close" badge={{ kind: 'dot' }} />,
    );
    expect(screen.getByTestId('close')).toBeTruthy();
    expect(screen.getByTestId('close-badge', { includeHiddenElements: true })).toBeTruthy();
  });

  it('accessibilityLabel vide refusé', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(
      renderThemed(<IconButton icon="X" accessibilityLabel="  " onPress={jest.fn()} />),
    ).rejects.toThrow(/accessibilityLabel/);
    spy.mockRestore();
  });

  it('accessibilityLabel obligatoire dans le type (tsc)', () => {
    // @ts-expect-error accessibilityLabel est obligatoire
    const element = <IconButton icon="X" onPress={jest.fn()} />;
    expect(element).toBeTruthy();
  });
});

describe('AC-ICON-7 : garde contre les imports lucide-react-native', () => {
  const root = path.resolve(__dirname, '..');
  const ICONS_MODULE = path.join('src', 'ui', 'icons.ts');

  function listSources(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : listSources(full);
      return /\.(ts|tsx|js|jsx)$/.test(entry.name) ? [full] : [];
    });
  }

  const files = [...listSources(path.join(root, 'src')), ...listSources(path.join(root, 'app'))];
  const IMPORT_RE = /(?:from|import|require\()\s*['"](lucide-react-native[^'"]*)['"]/g;

  function lucideImports(file: string): string[] {
    const source = fs.readFileSync(file, 'utf8');
    return [...source.matchAll(IMPORT_RE)].map((m) => m[1] as string);
  }

  it('scanne bien des fichiers', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('(a) aucun import de la racine lucide-react-native, nulle part', () => {
    const offenders = files.filter((f) => lucideImports(f).some((spec) => spec === 'lucide-react-native'));
    expect(offenders.map((f) => path.relative(root, f))).toEqual([]);
  });

  it('(b) tout import lucide-react-native/… est dans src/ui/icons.ts et passe par icons/<nom>', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const rel = path.relative(root, file);
      for (const spec of lucideImports(file)) {
        if (rel !== ICONS_MODULE) offenders.push(`${rel} -> ${spec}`);
        else if (!/^lucide-react-native\/icons\/[a-z0-9-]+$/.test(spec)) offenders.push(`${rel} -> ${spec}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('(c) icons.ts importe une icône par entrée du registre, rien d\'autre', () => {
    const imports = lucideImports(path.join(root, ICONS_MODULE));
    expect(imports).toHaveLength(ICON_NAMES.length);
    expect(new Set(imports).size).toBe(imports.length);
  });

  it('seuls icons.ts et les illustrations peuvent importer react-native-svg', () => {
    // Logo.tsx : le logo de marque est dessiné en SVG (src/ui/brandArt.ts), ce n'est pas une icône.
    const allowed = (rel: string) =>
      rel === ICONS_MODULE || rel === path.join('src', 'ui', 'Logo.tsx') || rel.startsWith(path.join('src', 'ui', 'illustrations'));
    const offenders = files
      .filter((f) => /from\s+['"]react-native-svg/.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(root, f))
      .filter((rel) => !allowed(rel));
    expect(offenders).toEqual([]);
  });
});
