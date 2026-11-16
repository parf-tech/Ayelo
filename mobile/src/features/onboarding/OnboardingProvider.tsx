import React, { createContext, useContext, useMemo, useState } from 'react';
import type { Gender, Intent } from '../../api/types';

export type ProfileDraft = {
  displayName: string;
  gender: Gender | null;
  country: string | null; // pays de résidence (ISO 3166-1 alpha-2)
  originCountry: string | null; // pays d'origine (ISO 3166-1 alpha-2)
  city: string;
  intent: Intent | null;
};

const emptyDraft: ProfileDraft = { displayName: '', gender: null, country: null, originCountry: null, city: '', intent: null };

type OnboardingContextValue = { draft: ProfileDraft; update: (patch: Partial<ProfileDraft>) => void; reset: () => void };

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

/** Brouillon du profil (S04, S05) : conservé en mémoire, envoyé par PUT /me/profile à la fin de S05. */
export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<ProfileDraft>(emptyDraft);
  const value = useMemo(
    () => ({
      draft,
      update: (patch: Partial<ProfileDraft>) => setDraft((d) => ({ ...d, ...patch })),
      reset: () => setDraft(emptyDraft),
    }),
    [draft],
  );
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboardingDraft(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboardingDraft doit être utilisé sous <OnboardingProvider>.');
  return ctx;
}
