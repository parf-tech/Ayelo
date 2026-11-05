import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { colors, ColorTokens, radius, space, type } from './tokens';

export type Scheme = 'light' | 'dark';

export type Theme = {
  scheme: Scheme;
  colors: ColorTokens;
  space: typeof space;
  radius: typeof radius;
  type: typeof type;
};

export function buildTheme(scheme: Scheme): Theme {
  return { scheme, colors: colors[scheme], space, radius, type };
}

const ThemeContext = createContext<Theme>(buildTheme('light'));

type Props = { children: React.ReactNode; scheme?: Scheme };

/** Fournit le thème clair ou sombre selon le réglage système (ou `scheme` forcé, utile en test). */
export function ThemeProvider({ children, scheme }: Props) {
  const system = useColorScheme();
  const resolved: Scheme = scheme ?? (system === 'dark' ? 'dark' : 'light');
  const theme = useMemo(() => buildTheme(resolved), [resolved]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
