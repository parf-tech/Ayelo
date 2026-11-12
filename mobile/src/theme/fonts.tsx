import React, { createContext, useContext } from 'react';
import { fontFamily } from './tokens';
import type { FontFamilyKey } from './tokens';

/** Vrai quand les polices de marque sont enregistrées. Faux par défaut : police du système (repli). */
const FontsReadyContext = createContext(false);

export function FontsReadyProvider({ ready, children }: { ready: boolean; children: React.ReactNode }) {
  return <FontsReadyContext.Provider value={ready}>{children}</FontsReadyContext.Provider>;
}

export function useFontsReady(): boolean {
  return useContext(FontsReadyContext);
}

/** Graisse CSS (« 600 », 600, « bold »...) vers la clé de famille la plus proche parmi celles chargées. */
export function fontFamilyKeyFor(weight: string | number | undefined): FontFamilyKey {
  if (weight === 'bold') return '700';
  const n = typeof weight === 'number' ? weight : Number(weight);
  if (!Number.isFinite(n) || n < 450) return '400';
  if (n < 550) return '500';
  if (n < 650) return '600';
  return '700';
}

/** Famille native pour une graisse : React Native ne synthétise pas les graisses d'une police personnalisée. */
export function fontFamilyFor(weight: string | number | undefined): string {
  return fontFamily[fontFamilyKeyFor(weight)];
}
