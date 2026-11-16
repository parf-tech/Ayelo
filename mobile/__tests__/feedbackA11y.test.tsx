import { act, fireEvent, screen, userEvent } from '@testing-library/react-native';
import React from 'react';
import { Platform, View } from 'react-native';
import { colors } from '../src/theme';
import {
  Banner,
  Button,
  ChoiceCard,
  ScreenContainer,
  Text,
  TextField,
  ToastProvider,
  useToast,
  toastDurationMs,
} from '../src/ui';
import { resetAnnounceDebounce } from '../src/ui/a11y/announce';
import { spyAnnounce } from './helpers/a11y';
import { flatStyle as flat, renderThemed } from './helpers/render';

jest.mock('expo-status-bar', () => ({
  StatusBar: (props: { style?: string }) =>
    require('react').createElement(require('react-native').View, { testID: 'status-bar', accessibilityLabel: props.style }),
}));

const originalOS = Platform.OS;
function setOS(os: 'ios' | 'android') {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => originalOS });
  resetAnnounceDebounce();
});

describe('Banner : pictogramme Lucide, type lu, annonce', () => {
  it('affiche une icône (pas un caractère texte) pour chaque variante, et plus de croix texte', async () => {
    await renderThemed(
      <>
        <Banner testID="b-ok" variant="success" message="Fait" />
        <Banner testID="b-err" variant="error" message="Raté" onDismiss={jest.fn()} dismissLabel="Fermer" />
      </>,
    );
    for (const id of ['b-ok-icon', 'b-err-icon']) {
      expect(screen.getByTestId(id, { includeHiddenElements: true })).toBeTruthy();
    }
    for (const glyph of ['✓', '✕', '!', 'i']) expect(screen.queryByText(glyph)).toBeNull();
    // La fermeture est un IconButton nommé par son action.
    expect(screen.getByRole('button', { name: 'Fermer' })).toBeOnTheScreen();
  });

  it('lit le type avant le message (« Erreur. Raté ») et garde le pastille extensible (pas de 24 x 24 fixe)', async () => {
    await renderThemed(<Banner testID="b" variant="error" message="Raté" />);
    expect(screen.getByText('Raté').props.accessibilityLabel).toBe('Erreur. Raté');
    // Le plus proche ancêtre de l'icône qui porte une largeur : la pastille colorée.
    let node = screen.getByTestId('b-icon', { includeHiddenElements: true }).parent;
    while (node && flat(node.props.style).minWidth === undefined && flat(node.props.style).width === undefined) node = node.parent;
    const style = flat(node?.props.style);
    expect(style.width).toBeUndefined();
    expect(Number(style.minWidth)).toBeGreaterThan(0);
    expect(Number(style.minHeight)).toBeGreaterThan(0);
  });

  it('en anglais, le type est traduit', async () => {
    await renderThemed(<Banner variant="warning" message="Careful" />, { locale: 'en' });
    expect(screen.getByText('Careful').props.accessibilityLabel).toBe('Warning. Careful');
  });

  it('iOS : annonce une erreur, un avertissement et un succès, pas une simple information', async () => {
    setOS('ios');
    const spy = spyAnnounce();
    await renderThemed(<Banner variant="error" message="Hors ligne" />);
    expect(spy).toHaveBeenCalledWith('Erreur. Hors ligne');
    spy.mockClear();
    await renderThemed(<Banner variant="info" message="Astuce" />);
    expect(spy).not.toHaveBeenCalled();
  });

  it('Android : aucune annonce (la région vivante suffit)', async () => {
    setOS('android');
    const spy = spyAnnounce();
    await renderThemed(<Banner variant="error" message="Hors ligne" />);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('TextField : annonce du message d’erreur', () => {
  it('iOS : annonce le libellé et l’erreur quand elle apparaît', async () => {
    setOS('ios');
    const spy = spyAnnounce();
    const { rerender } = await renderThemed(<TextField label="E-mail" value="" onChangeText={jest.fn()} />);
    expect(spy).not.toHaveBeenCalled();
    await rerender(<TextField label="E-mail" value="" onChangeText={jest.fn()} error="Adresse invalide" />);
    expect(spy).toHaveBeenCalledWith('E-mail. Adresse invalide');
  });
});

describe('Toast : durée, action, position', () => {
  function Trigger({ options }: { options: Parameters<ReturnType<typeof useToast>['show']>[0] }) {
    const toast = useToast();
    return <Button label="Go" onPress={() => toast.show(options)} />;
  }

  async function open(options: Parameters<ReturnType<typeof useToast>['show']>[0]) {
    jest.useFakeTimers();
    await renderThemed(
      <ToastProvider>
        <Trigger options={options} />
      </ToastProvider>,
    );
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await user.press(screen.getByRole('button', { name: 'Go' }));
  }

  it('un toast avec action reste affiché jusqu’à fermeture (pas de disparition automatique)', async () => {
    await open({ message: 'Nouveau match', actionLabel: 'Voir', onAction: jest.fn() });
    await act(async () => {
      jest.advanceTimersByTime(120000);
    });
    expect(screen.getByText('Nouveau match')).toBeOnTheScreen();
    await userEvent.setup({ advanceTimers: jest.advanceTimersByTime }).press(screen.getByRole('button', { name: 'Fermer la notification' }));
    expect(screen.queryByText('Nouveau match')).not.toBeOnTheScreen();
  });

  it('une durée imposée trop courte sur un toast avec action est portée à 10 s', () => {
    expect(toastDurationMs({ actionLabel: 'Voir', durationMs: 1000 })).toBe(10000);
    expect(toastDurationMs({ actionLabel: 'Voir' })).toBeNull();
  });

  it('une erreur reste au moins 10 s, un succès 6 s', async () => {
    await open({ message: 'Échec', variant: 'error' });
    await act(async () => {
      jest.advanceTimersByTime(9000);
    });
    expect(screen.getByText('Échec')).toBeOnTheScreen();
    await act(async () => {
      jest.advanceTimersByTime(1500);
    });
    expect(screen.queryByText('Échec')).not.toBeOnTheScreen();
    expect(toastDurationMs({ variant: 'success' })).toBe(6000);
    expect(toastDurationMs({ variant: 'info' })).toBe(6000);
    expect(toastDurationMs({ variant: 'error' })).toBe(10000);
  });

  it('iOS : annonce le toast à son apparition', async () => {
    setOS('ios');
    const spy = spyAnnounce();
    await open({ message: 'Enregistré', variant: 'success' });
    expect(spy).toHaveBeenCalledWith('Succès. Enregistré');
  });

  it('se pose au-dessus de la barre d’onglets quand un décalage est déclaré', async () => {
    function Tabs() {
      const toast = useToast();
      React.useEffect(() => {
        toast.setBottomOffset(56);
        toast.show({ message: 'Au-dessus', variant: 'info' });
      }, [toast]);
      return null;
    }
    await renderThemed(
      <ToastProvider>
        <Tabs />
      </ToastProvider>,
    );
    const host = screen.getByTestId('toast').parent?.parent;
    // 56 (barre) + 16 (marge) ; la zone sûre est nulle sous Jest.
    expect(flat(host?.props.style).bottom).toBe(56 + 16);
    expect(flat(host?.props.style).zIndex).toBeGreaterThan(0);
  });
});

describe('Anneau de focus', () => {
  it('Button : anneau de la couleur focusRing par défaut, onBrand sur le fond prune', async () => {
    await renderThemed(
      <>
        <Button testID="b-default" label="Un" onPress={jest.fn()} />
        <Button testID="b-brand" tone="onBrand" variant="secondary" label="Deux" onPress={jest.fn()} />
      </>,
    );
    await fireEvent(screen.getByTestId('b-default'), 'focus');
    await fireEvent(screen.getByTestId('b-brand'), 'focus');
    expect(flat(screen.getByTestId('b-default').props.style).outlineColor).toBe(colors.light.focusRing);
    // focusRing = brand en clair : sans correction l'anneau serait invisible sur le fond prune.
    expect(flat(screen.getByTestId('b-brand').props.style).outlineColor).toBe(colors.light.onBrand);
    expect(colors.light.focusRing).toBe(colors.light.brand);
  });

  it('ChoiceCard : anneau visible au focus clavier', async () => {
    await renderThemed(<ChoiceCard testID="cc" label="Choix" selected={false} onPress={jest.fn()} />);
    expect(flat(screen.getByTestId('cc').props.style).outlineWidth).toBeUndefined();
    await fireEvent(screen.getByTestId('cc'), 'focus');
    expect(flat(screen.getByTestId('cc').props.style).outlineWidth).toBe(2);
  });
});

describe('Barre d’état et rôle des titres', () => {
  it('ScreenContainer tone="brand" force des icônes de barre d’état claires', async () => {
    await renderThemed(
      <ScreenContainer tone="brand">
        <View />
      </ScreenContainer>,
    );
    expect(screen.getByTestId('status-bar', { includeHiddenElements: true }).props.accessibilityLabel).toBe('light');
  });

  it('ScreenContainer par défaut ne touche pas à la barre d’état', async () => {
    await renderThemed(
      <ScreenContainer>
        <View />
      </ScreenContainer>,
    );
    expect(screen.queryByTestId('status-bar', { includeHiddenElements: true })).toBeNull();
  });

  it('Text header : le rôle titre l’emporte sur un rôle explicite ; sans header, le rôle explicite s’applique', async () => {
    await renderThemed(
      <>
        <Text header accessibilityRole="alert" testID="t1">
          Titre
        </Text>
        <Text accessibilityRole="link" testID="t2">
          Lien
        </Text>
      </>,
    );
    expect(screen.getByTestId('t1').props.accessibilityRole).toBe('header');
    expect(screen.getByTestId('t2').props.accessibilityRole).toBe('link');
  });
});
