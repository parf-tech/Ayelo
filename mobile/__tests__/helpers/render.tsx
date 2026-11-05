import { render } from '@testing-library/react-native';
import React from 'react';
import { I18nProvider, Locale } from '../../src/i18n';
import { Scheme, ThemeProvider } from '../../src/theme';

type Options = { scheme?: Scheme; locale?: Locale };

/** Rend un composant avec thème (clair par défaut) et i18n (français par défaut). */
export function renderThemed(ui: React.ReactElement, { scheme = 'light', locale = 'fr' }: Options = {}) {
  return render(
    <ThemeProvider scheme={scheme}>
      <I18nProvider initialLocale={locale}>{ui}</I18nProvider>
    </ThemeProvider>,
  );
}

/** Aplatit un style React Native (tableaux imbriqués) en un seul objet. */
export function flatStyle(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
}
