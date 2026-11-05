import { getLocales } from 'expo-localization';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { appStorage } from '../storage/appStorage';
import type { TranslationKey } from './fr';
import { Locale, resolveLocale, SUPPORTED_LOCALES, translate, TranslationParams } from './translate';

export type I18n = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: TranslationParams) => string;
};

const I18nContext = createContext<I18n | null>(null);

function deviceLocale(): Locale {
  try {
    return resolveLocale(getLocales()[0]?.languageCode);
  } catch {
    return resolveLocale(undefined);
  }
}

type Props = { children: React.ReactNode; initialLocale?: Locale };

/**
 * Langue = préférence enregistrée, sinon langue du téléphone (fr ou en), sinon français.
 * Le choix de l'utilisateur est mémorisé et prime sur la langue du téléphone.
 */
export function I18nProvider({ children, initialLocale }: Props) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? deviceLocale());

  useEffect(() => {
    if (initialLocale) return;
    let cancelled = false;
    appStorage.getLocale().then((saved) => {
      if (!cancelled && saved && (SUPPORTED_LOCALES as readonly string[]).includes(saved)) {
        setLocaleState(saved as Locale);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [initialLocale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    void appStorage.setLocale(next);
  }, []);

  const value = useMemo<I18n>(
    () => ({ locale, setLocale, t: (key, params) => translate(locale, key, params) }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n doit être utilisé sous <I18nProvider>.');
  return ctx;
}
