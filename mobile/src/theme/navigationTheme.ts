import { DarkTheme, DefaultTheme } from 'expo-router';
import { colors } from './tokens';
import type { Scheme } from './ThemeProvider';

/**
 * Thème de React Navigation construit sur les jetons de l'application (clair et sombre).
 * Sans lui, la navigation peint ses propres couleurs (fond clair) avant que nos écrans ne se montrent :
 * flash blanc en mode sombre. Les polices viennent des thèmes par défaut (champ obligatoire).
 */
export function buildNavigationTheme(scheme: Scheme) {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const c = colors[scheme];
  return {
    ...base,
    dark: scheme === 'dark',
    colors: {
      ...base.colors,
      primary: c.primary,
      background: c.bg,
      card: c.bg,
      text: c.text,
      border: c.border,
      notification: c.primary,
    },
  };
}
