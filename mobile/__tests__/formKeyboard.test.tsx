import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import { TextInput } from 'react-native';
import { CountryPicker } from '../src/features/onboarding/CountryPicker';
import { ProfileEditScreen } from '../src/features/profile/ProfileEditScreen';
import { ExportScreen } from '../src/features/settings/ExportScreen';
import { SupportScreen } from '../src/features/settings/SupportScreen';
import { resetDeviceIdCacheForTests } from '../src/storage/deviceId';
import { tokenStore } from '../src/storage/tokenStore';
import { installFakeApi } from './helpers/fakeApi';
import { meFixture } from './helpers/fixtures';
import { renderThemed } from './helpers/render';
import { resetRouterMocks } from './helpers/routerMock';
import { renderShell } from './helpers/shell';

jest.mock('expo-router', () => ({
  ...require('./helpers/routerMock').expoRouterMock,
  useLocalSearchParams: () => ({}),
}));

/**
 * Revue design P1-7 (clavier) : un formulaire à un champ se valide depuis le clavier (touche « Terminé »), un formulaire à
 * plusieurs champs enchaîne du premier au suivant (touche « Suivant »). Les champs multilignes gardent le retour à la ligne.
 */

const ME = meFixture();
const user = () => userEvent.setup();

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  tokenStore.resetCacheForTests();
  resetDeviceIdCacheForTests();
  resetRouterMocks();
});

afterEach(async () => {
  await act(async () => undefined);
});

describe('export des données : mot de passe', () => {
  it('la touche « Terminé » envoie la demande, comme le bouton', async () => {
    const fake = installFakeApi({
      'GET /me': [200, ME],
      'POST /me/export': [202, { id: 'e1', status: 'pending' }],
      'GET /me/export/e1': [200, { id: 'e1', status: 'pending' }],
    });
    await renderShell(<ExportScreen />);
    const field = screen.getByTestId('export-password');
    expect(field.props.returnKeyType).toBe('done');
    await user().type(field, 'Motdepasse123', { submitEditing: true });
    await waitFor(() => expect(fake.called('POST /me/export')).toHaveLength(1));
    expect(fake.called('POST /me/export')[0]?.body).toEqual({ password: 'Motdepasse123' });
  });
});

describe('aide et assistance : objet puis message', () => {
  it('l’objet propose « Suivant » et envoie le focus au message ; le message garde le retour à la ligne', async () => {
    installFakeApi({ 'GET /me': [200, ME], 'GET /support/tickets': [200, { data: [] }] });
    const focus = jest.spyOn(TextInput.prototype, 'focus');
    await renderShell(<SupportScreen />);
    const subject = await screen.findByTestId('support-subject');
    expect(subject.props.returnKeyType).toBe('next');
    expect(screen.getByTestId('support-body').props.returnKeyType).toBeUndefined();
    focus.mockClear();
    await user().type(subject, 'Un souci', { submitEditing: true });
    expect(focus).toHaveBeenCalledTimes(1);
    focus.mockRestore();
  });
});

describe('modifier mon profil : champs d’une ligne', () => {
  it('le prénom et la ville proposent « Terminé » ; la présentation (multiligne) n’a pas de touche de validation', async () => {
    installFakeApi({ 'GET /me': [200, ME] });
    await renderShell(<ProfileEditScreen />);
    expect((await screen.findByTestId('edit-name')).props.returnKeyType).toBe('done');
    expect(screen.getByTestId('edit-city').props.returnKeyType).toBe('done');
    expect(screen.getByTestId('edit-bio').props.returnKeyType).toBeUndefined();
  });
});

describe('sélecteur de pays : recherche', () => {
  it('la touche du clavier est « Rechercher » et le champ filtre en direct', async () => {
    await renderThemed(<CountryPicker value={null} onChange={jest.fn()} idPrefix="c" />);
    expect(screen.getByTestId('c-search').props.returnKeyType).toBe('search');
  });
});
