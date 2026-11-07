import { act, screen, userEvent } from '@testing-library/react-native';
import React from 'react';
import { Text as RNText, View } from 'react-native';
import { colors, MIN_TARGET } from '../src/theme';
import {
  Banner,
  Button,
  CheckboxField,
  ChoiceCard,
  ListRow,
  EmptyState,
  ProgressBar,
  ScreenContainer,
  Skeleton,
  TextField,
  ToastProvider,
  useToast,
} from '../src/ui';
import { flatStyle as flat, renderThemed } from './helpers/render';

describe('Button', () => {
  it('appelle onPress (état par défaut) avec rôle bouton et cible >= 44', async () => {
    const onPress = jest.fn();
    await renderThemed(<Button label="Valider" onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Valider' });
    expect(button).toBeEnabled();
    const style = flat(button.props.style);
    expect(Number(style.minHeight)).toBeGreaterThanOrEqual(MIN_TARGET);
    expect(Number(style.minWidth)).toBeGreaterThanOrEqual(MIN_TARGET);
    await userEvent.setup().press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('utilise les couleurs du thème clair selon la variante', async () => {
    await renderThemed(<Button label="Danger" variant="danger" onPress={jest.fn()} />);
    expect(flat(screen.getByRole('button').props.style).backgroundColor).toBe(colors.light.danger);
  });

  it('utilise les couleurs du thème sombre', async () => {
    await renderThemed(<Button label="Principal" onPress={jest.fn()} />, { scheme: 'dark' });
    expect(flat(screen.getByRole('button').props.style).backgroundColor).toBe(colors.dark.primary);
  });

  it("état disabled : pas d'appel, état accessible désactivé", async () => {
    const onPress = jest.fn();
    await renderThemed(<Button label="Désactivé" disabled onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Désactivé' });
    expect(button).toBeDisabled();
    expect(flat(button.props.style).backgroundColor).toBe(colors.light.disabledBg);
    await userEvent.setup().press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('état loading : spinner, occupé, pas de double appel', async () => {
    const onPress = jest.fn();
    await renderThemed(<Button label="Envoi" loading testID="btn" onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Envoi' });
    expect(button).toBeBusy();
    expect(button).toBeDisabled();
    expect(screen.getByTestId('btn-spinner')).toBeOnTheScreen();
    await userEvent.setup().press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("accessibilityLabel remplace le texte pour les lecteurs d'écran", async () => {
    await renderThemed(<Button label="OK" accessibilityLabel="Confirmer la date" onPress={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Confirmer la date' })).toBeOnTheScreen();
  });
});

describe('TextField', () => {
  it('affiche libellé et valeur, et appelle onChangeText', async () => {
    const onChange = jest.fn();
    await renderThemed(<TextField label="Prénom" value="Ana" onChangeText={onChange} testID="f" />);
    const input = screen.getByLabelText('Prénom');
    expect(input).toHaveDisplayValue('Ana');
    await userEvent.setup().type(input, 'x');
    expect(onChange).toHaveBeenCalled();
  });

  it('état erreur : message annoncé comme alerte', async () => {
    await renderThemed(<TextField label="Email" value="" onChangeText={jest.fn()} error="Adresse invalide" testID="f" />);
    expect(screen.getByText('Adresse invalide')).toBeOnTheScreen();
    expect(screen.getByTestId('f-error').props.accessibilityRole).toBe('alert');
  });

  it('état désactivé : non modifiable', async () => {
    await renderThemed(<TextField label="Ville" value="Paris" onChangeText={jest.fn()} disabled />);
    expect(screen.getByLabelText('Ville')).toBeDisabled();
  });

  it('mot de passe masqué par défaut, bouton afficher / masquer >= 44', async () => {
    await renderThemed(
      <TextField
        label="Mot de passe"
        value="secret"
        onChangeText={jest.fn()}
        secureTextEntry
        passwordToggleLabels={{ show: 'Afficher', hide: 'Masquer' }}
      />,
    );
    expect(screen.getByLabelText('Mot de passe').props.secureTextEntry).toBe(true);
    const toggle = screen.getByRole('button', { name: 'Afficher' });
    expect(Number(flat(toggle.props.style).minHeight)).toBeGreaterThanOrEqual(MIN_TARGET);
    await userEvent.setup().press(toggle);
    expect(screen.getByLabelText('Mot de passe').props.secureTextEntry).toBe(false);
    expect(screen.getByRole('button', { name: 'Masquer' })).toBeOnTheScreen();
  });
});

describe('ChoiceCard et CheckboxField', () => {
  it('ChoiceCard : sélectionné / non sélectionné, rôle radio', async () => {
    const onPress = jest.fn();
    await renderThemed(
      <View>
        <ChoiceCard label="Mariage" selected onPress={onPress} />
        <ChoiceCard label="Flirt" selected={false} onPress={jest.fn()} />
      </View>,
    );
    expect(screen.getByRole('radio', { name: 'Mariage' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Flirt' })).not.toBeChecked();
    await userEvent.setup().press(screen.getByRole('radio', { name: 'Mariage' }));
    expect(onPress).toHaveBeenCalled();
  });

  it('ChoiceCard : désactivée', async () => {
    const onPress = jest.fn();
    await renderThemed(<ChoiceCard label="X" selected={false} disabled onPress={onPress} />);
    await userEvent.setup().press(screen.getByRole('radio'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("CheckboxField : bascule et annonce l'état coché", async () => {
    const onChange = jest.fn();
    await renderThemed(<CheckboxField label="CGU" badge="Obligatoire" checked={false} onChange={onChange} />);
    const box = screen.getByRole('checkbox', { name: 'CGU, Obligatoire' });
    expect(box).not.toBeChecked();
    await userEvent.setup().press(box);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('Banner, Toast, Skeleton, EmptyState, ProgressBar, ScreenContainer', () => {
  it('Banner : message, action et fermeture', async () => {
    const onAction = jest.fn();
    const onDismiss = jest.fn();
    await renderThemed(
      <Banner
        variant="error"
        message="Échec"
        actionLabel="Réessayer"
        onAction={onAction}
        onDismiss={onDismiss}
        dismissLabel="Fermer"
      />,
    );
    expect(screen.getByText('Échec')).toBeOnTheScreen();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Réessayer' }));
    await user.press(screen.getByRole('button', { name: 'Fermer' }));
    expect(onAction).toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalled();
  });

  it('Banner : une erreur est annoncée comme alerte', async () => {
    await renderThemed(<Banner variant="error" message="Oups" testID="b" />);
    expect(screen.getByTestId('b').props.accessibilityRole).toBe('alert');
  });

  it("Toast : s'affiche puis disparaît tout seul", async () => {
    jest.useFakeTimers();
    function Trigger() {
      const toast = useToast();
      return (
        <Button
          label="Go"
          onPress={() => toast.show({ message: 'Enregistré', variant: 'success', durationMs: 1000 })}
        />
      );
    }
    await renderThemed(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await user.press(screen.getByRole('button', { name: 'Go' }));
    expect(screen.getByText('Enregistré')).toBeOnTheScreen();
    await act(async () => {
      jest.advanceTimersByTime(1200);
    });
    expect(screen.queryByText('Enregistré')).not.toBeOnTheScreen();
    jest.useRealTimers();
  });

  it('Skeleton : marqué comme occupé', async () => {
    await renderThemed(<Skeleton variant="card" />);
    expect(screen.getByTestId('skeleton')).toBeBusy();
  });

  it('EmptyState : titre, description et action', async () => {
    const onAction = jest.fn();
    await renderThemed(
      <EmptyState title="Rien ici" description="Revenez plus tard" actionLabel="Actualiser" onAction={onAction} />,
    );
    expect(screen.getByText('Rien ici')).toBeOnTheScreen();
    await userEvent.setup().press(screen.getByRole('button', { name: 'Actualiser' }));
    expect(onAction).toHaveBeenCalled();
  });

  it('ProgressBar : valeur accessible', async () => {
    await renderThemed(<ProgressBar current={1} total={2} label="Étape 1 sur 2" />);
    expect(screen.getByRole('progressbar', { name: 'Étape 1 sur 2' })).toHaveAccessibilityValue({
      min: 0,
      max: 2,
      now: 1,
    });
  });

  it('ScreenContainer : rend ses enfants et le pied de page fixe', async () => {
    await renderThemed(
      <ScreenContainer footer={<RNText>pied</RNText>}>
        <RNText>contenu</RNText>
      </ScreenContainer>,
    );
    expect(screen.getByText('contenu')).toBeOnTheScreen();
    expect(screen.getByText('pied')).toBeOnTheScreen();
  });
});

describe('ListRow : accessibilité des lignes avec bouton', () => {
  function accessibleAncestors(node: { parent: unknown }): number {
    let count = 0;
    let current = (node as { parent: { props?: { accessible?: boolean }; parent: unknown } | null }).parent;
    while (current) {
      if (current.props?.accessible === true) count += 1;
      current = current.parent as typeof current | null;
    }
    return count;
  }

  it('une ligne sans onPress avec bouton en trailing ne regroupe pas son bouton (VoiceOver)', async () => {
    const onPress = jest.fn();
    await renderThemed(
      <ListRow
        testID="row"
        label="Pack 50 crédits"
        description="9,99 €"
        accessibilityLabel="Pack 50 crédits. 9,99 €"
        trailing={<Button label="Acheter" accessibilityLabel="Acheter le pack 50 crédits" onPress={onPress} />}
      />,
    );
    const button = screen.getByRole('button', { name: 'Acheter le pack 50 crédits' });
    expect(accessibleAncestors(button)).toBe(0);
    expect(screen.getByTestId('row').props.accessible).toBe(false);
    await userEvent.setup().press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('une ligne purement informative reste regroupée', async () => {
    await renderThemed(<ListRow testID="row" label="Version" value="1.0" accessibilityLabel="Version 1.0" />);
    expect(screen.getByTestId('row').props.accessible).toBe(true);
    expect(screen.getByLabelText('Version 1.0')).toBeTruthy();
  });

  it('une ligne cliquable est un seul bouton', async () => {
    await renderThemed(<ListRow label="Langue" onPress={jest.fn()} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});
