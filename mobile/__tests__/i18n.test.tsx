import { act, render, screen, userEvent } from '@testing-library/react-native';
import * as Localization from 'expo-localization';
import * as SecureStore from 'expo-secure-store';
import React from 'react';
import { Text } from 'react-native';
import { ApiError } from '../src/api';
import { dictionaries, I18nProvider, resolveLocale, translate, useI18n } from '../src/i18n';
import { apiErrorMessage } from '../src/i18n/apiErrors';
import { en } from '../src/i18n/en';
import { fr } from '../src/i18n/fr';
import { Button } from '../src/ui';
import { renderThemed } from './helpers/render';

const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();

describe('i18n : parité fr / en', () => {
  it('fr et en ont exactement les mêmes clés', () => {
    const frKeys = Object.keys(fr).sort();
    const enKeys = Object.keys(en).sort();
    expect(enKeys).toEqual(frKeys);
  });

  it('aucune traduction vide', () => {
    for (const locale of ['fr', 'en'] as const) {
      for (const [key, value] of Object.entries(dictionaries[locale])) {
        expect(`${locale}:${key}:${value.trim().length > 0}`).toBe(`${locale}:${key}:true`);
      }
    }
  });

  it('les paramètres {nom} sont identiques dans les deux langues', () => {
    for (const key of Object.keys(fr) as (keyof typeof fr)[]) {
      expect({ key, params: placeholders(en[key]) }).toEqual({ key, params: placeholders(fr[key]) });
    }
  });

  it('les traductions anglaises ne sont pas de simples copies du français (hors termes identiques par nature)', () => {
    const byNature = (k: string) =>
      ['app.name', 'intent.flirt.label', 'demo.sample.danger', 'birthdate.monthPlaceholder', 'brand.logoLabel', 'demo.logo', 'onboarding.step.photos'].includes(k) || k.startsWith('language.name.') || k.startsWith('country.');
    const identical = (Object.keys(fr) as (keyof typeof fr)[]).filter((k) => fr[k] === en[k] && !byNature(k));
    expect(identical).toEqual([]);
  });
});

describe('translate / resolveLocale', () => {
  it('interpole les paramètres', () => {
    expect(translate('fr', 'home.signedInAs', { email: 'a@b.fr' })).toBe('Connecté en tant que a@b.fr');
    expect(translate('en', 'home.signedInAs', { email: 'a@b.fr' })).toBe('Signed in as a@b.fr');
  });

  it('résout la langue du téléphone vers fr ou en, sinon fr', () => {
    expect(resolveLocale('fr-CA')).toBe('fr');
    expect(resolveLocale('en_US')).toBe('en');
    expect(resolveLocale('EN')).toBe('en');
    expect(resolveLocale('de-DE')).toBe('fr');
    expect(resolveLocale(null)).toBe('fr');
    expect(resolveLocale(undefined)).toBe('fr');
  });
});

describe('I18nProvider', () => {
  function Probe() {
    const { t, locale, setLocale } = useI18n();
    return (
      <>
        <Text testID="locale">{locale}</Text>
        <Text testID="title">{t('welcome.createAccount')}</Text>
        <Button label="switch" onPress={() => setLocale(locale === 'fr' ? 'en' : 'fr')} />
      </>
    );
  }

  it('démarre avec la langue du téléphone', async () => {
    (Localization.getLocales as jest.Mock).mockReturnValueOnce([{ languageCode: 'en', languageTag: 'en-US' }]);
    await render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByTestId('locale')).toHaveTextContent('en');
    expect(screen.getByTestId('title')).toHaveTextContent('Create an account');
  });

  it('permet de changer de langue et mémorise le choix (stockage sécurisé)', async () => {
    await renderThemed(<Probe />);
    expect(screen.getByTestId('title')).toHaveTextContent('Créer un compte');
    await userEvent.setup().press(screen.getByRole('button', { name: 'switch' }));
    expect(screen.getByTestId('title')).toHaveTextContent('Create an account');
    await act(async () => undefined);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('ayelo.locale', 'en');
  });
});

describe('apiErrorMessage', () => {
  const err = (status: number, code: string, extra: Partial<ConstructorParameters<typeof ApiError>[0]> = {}) =>
    new ApiError({ status, code, message: code, ...extra });

  it('associe les erreurs API à des clés traduisibles', () => {
    expect(apiErrorMessage(err(401, 'invalid_credentials')).key).toBe('error.invalid_credentials');
    expect(apiErrorMessage(err(403, 'account_restricted')).key).toBe('error.account_restricted');
    expect(apiErrorMessage(err(422, 'validation_failed')).key).toBe('error.validation');
    expect(apiErrorMessage(err(500, 'server_error')).key).toBe('error.server');
    expect(apiErrorMessage(err(0, 'network_error')).key).toBe('error.network');
    expect(apiErrorMessage(err(0, 'config_missing')).key).toBe('error.config');
    expect(apiErrorMessage(new Error('x')).key).toBe('error.unknown');
  });

  it('429 : avec ou sans Retry-After', () => {
    expect(apiErrorMessage(err(429, 'rate_limited', { retryAfter: 30 }))).toEqual({
      key: 'error.rate_limited',
      params: { seconds: 30 },
    });
    expect(apiErrorMessage(err(429, 'rate_limited')).key).toBe('error.rate_limited.generic');
  });
});
