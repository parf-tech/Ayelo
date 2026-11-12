import { screen } from '@testing-library/react-native';
import React from 'react';
import { colors, fontFamily, fontFamilyFor, FontsReadyProvider, type } from '../src/theme';
import { FONT_ASSETS } from '../src/theme/fontAssets';
import { Logo, Text } from '../src/ui';
import { SYMBOL_RATIO } from '../src/ui/brandArt';
import { flatStyle as flat, renderThemed } from './helpers/render';

describe('Text : police Poppins par graisse', () => {
  it('avant chargement : police du système, graisse du jeton (aucune famille personnalisée)', async () => {
    await renderThemed(<Text variant="title">Titre</Text>);
    const style = flat(screen.getByText('Titre').props.style);
    expect(style.fontFamily).toBeUndefined();
    expect(style.fontWeight).toBe(type.title.weight);
  });

  it('après chargement : chaque variante résout la famille de sa graisse, sans fontWeight', async () => {
    const expected: Record<string, string> = {
      title: fontFamily[700],
      h2: fontFamily[600],
      h3: fontFamily[600],
      body: fontFamily[400],
      bodySmall: fontFamily[400],
      caption: fontFamily[400],
      label: fontFamily[500],
      captionStrong: fontFamily[600],
    };
    for (const [variant, family] of Object.entries(expected)) {
      await renderThemed(
        <FontsReadyProvider ready>
          <Text variant={variant as keyof typeof expected & Parameters<typeof Text>[0]['variant']}>{`v-${variant}`}</Text>
        </FontsReadyProvider>,
      );
      const style = flat(screen.getByText(`v-${variant}`).props.style);
      expect(style.fontFamily).toBe(family);
      expect(style.fontWeight).toBeUndefined();
    }
  });

  it('un fontWeight passé en style choisit la famille correspondante (et disparaît du style)', async () => {
    await renderThemed(
      <FontsReadyProvider ready>
        <Text variant="body" style={{ fontWeight: '600' }}>
          Appuyé
        </Text>
      </FontsReadyProvider>,
    );
    const style = flat(screen.getByText('Appuyé').props.style);
    expect(style.fontFamily).toBe('Poppins_600SemiBold');
    expect(style.fontWeight).toBeUndefined();
  });

  it('fontWeight en style avant chargement : conservé pour la police du système', async () => {
    await renderThemed(
      <Text variant="body" style={{ fontWeight: '700' }}>
        Gras
      </Text>,
    );
    expect(flat(screen.getByText('Gras').props.style).fontWeight).toBe('700');
  });

  it('graisses proches ramenées à une famille chargée', () => {
    expect(fontFamilyFor('bold')).toBe('Poppins_700Bold');
    expect(fontFamilyFor('normal')).toBe('Poppins_400Regular');
    expect(fontFamilyFor(undefined)).toBe('Poppins_400Regular');
    expect(fontFamilyFor('300')).toBe('Poppins_400Regular');
    expect(fontFamilyFor('500')).toBe('Poppins_500Medium');
    expect(fontFamilyFor('800')).toBe('Poppins_700Bold');
  });

  it('les polices chargées sont exactement les quatre familles des jetons', () => {
    expect(Object.keys(FONT_ASSETS).sort()).toEqual(Object.values(fontFamily).sort());
  });
});

describe('Logo', () => {
  it('rôle image, étiquette par défaut traduite (fr et en)', async () => {
    await renderThemed(<Logo testID="logo" />);
    expect(screen.getByRole('image', { name: 'Ayelo' })).toBeOnTheScreen();
    await renderThemed(<Logo testID="logo-en" />, { locale: 'en' });
    expect(screen.getByLabelText('Ayelo', { exact: true })).toBeOnTheScreen();
  });

  it('étiquette personnalisée', async () => {
    await renderThemed(<Logo accessibilityLabel="Logo de l'application" />);
    expect(screen.getByRole('image', { name: "Logo de l'application" })).toBeOnTheScreen();
  });

  it('la largeur du symbole suit le rapport du cadre pour toute taille', async () => {
    for (const size of [24, 32, 48, 120]) {
      await renderThemed(<Logo testID={`l${size}`} size={size} />);
      const svg = screen.getByTestId(`l${size}-symbol`);
      expect(Number(svg.props.height ?? svg.props.bbHeight)).toBeCloseTo(size, 5);
      expect(Number(svg.props.width ?? svg.props.bbWidth) / size).toBeCloseTo(SYMBOL_RATIO, 5);
    }
  });

  it('symbole seul : pas de mot-symbole ; horizontal : « Ayelo » en texte Poppins Bold, taille proportionnelle', async () => {
    await renderThemed(<Logo testID="a" size={50} />);
    expect(screen.queryByTestId('a-wordmark')).toBeNull();
    await renderThemed(
      <FontsReadyProvider ready>
        <Logo testID="b" size={50} layout="horizontal" />
        <Logo testID="c" size={100} layout="horizontal" />
      </FontsReadyProvider>,
    );
    const small = flat(screen.getByTestId('b-wordmark').props.style);
    const big = flat(screen.getByTestId('c-wordmark').props.style);
    expect(small.fontFamily).toBe('Poppins_700Bold');
    expect(Number(big.fontSize) / Number(small.fontSize)).toBeCloseTo(2, 5);
    expect(Number(small.fontSize) / 50).toBeCloseTo(174 / 350, 5);
    expect(screen.getByTestId('b-wordmark').props.accessible).toBe(false);
  });

  it('la couleur du mot-symbole suit la variante et le thème (jetons)', async () => {
    await renderThemed(<Logo testID="c" layout="horizontal" />);
    expect(flat(screen.getByTestId('c-wordmark').props.style).color).toBe(colors.light.text);
    await renderThemed(<Logo testID="d" layout="horizontal" />, { scheme: 'dark' });
    expect(flat(screen.getByTestId('d-wordmark').props.style).color).toBe(colors.dark.text);
    await renderThemed(<Logo testID="w" layout="horizontal" variant="white" />);
    expect(flat(screen.getByTestId('w-wordmark').props.style).color).toBe(colors.light.onBrand);
    await renderThemed(<Logo testID="m" layout="horizontal" variant="mono" />, { scheme: 'dark' });
    expect(flat(screen.getByTestId('m-wordmark').props.style).color).toBe(colors.dark.text);
  });

  it('les trois variantes se rendent sans erreur et gardent le même cadre', async () => {
    for (const variant of ['color', 'white', 'mono'] as const) {
      await renderThemed(<Logo testID={`v-${variant}`} variant={variant} size={64} layout="horizontal" />);
      expect(screen.getByTestId(`v-${variant}`)).toBeOnTheScreen();
      expect(Number(flat(screen.getByTestId(`v-${variant}`).props.style).height)).toBe(64);
    }
  });
});
