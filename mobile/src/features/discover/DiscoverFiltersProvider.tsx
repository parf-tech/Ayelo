import React, { createContext, useContext, useMemo, useState } from 'react';
import type { DiscoverFilters } from '../../api/types';

export type ActiveFilters = Pick<DiscoverFilters, 'age_min' | 'age_max' | 'countries' | 'origins' | 'intents' | 'verified_only'>;

type FiltersContextValue = {
  /** null = aucun filtre choisi : le serveur applique les préférences enregistrées (S07). */
  filters: ActiveFilters | null;
  setFilters: (filters: ActiveFilters | null) => void;
};

const FiltersContext = createContext<FiltersContextValue | null>(null);

/** Filtres de S09 conservés pendant la session (mémoire). */
export function DiscoverFiltersProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = useState<ActiveFilters | null>(null);
  const value = useMemo(() => ({ filters, setFilters }), [filters]);
  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useDiscoverFilters(): FiltersContextValue {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error('useDiscoverFilters doit être utilisé sous <DiscoverFiltersProvider>.');
  return ctx;
}
