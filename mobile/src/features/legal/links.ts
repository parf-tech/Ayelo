import { Linking } from 'react-native';
import { readPublicEnv, type PublicEnv } from '../../config/env';

export type LegalLinks = {
  terms: string | null;
  privacy: string | null;
  community: string | null;
  supportEmail: string | null;
};

function httpUrl(value: string | undefined): string | null {
  const v = value?.trim();
  return v && /^https?:\/\/\S+$/i.test(v) ? v : null;
}

/** Adresses des textes légaux (CGU, confidentialité, règles de la communauté) : variables EXPO_PUBLIC_*, jamais codées en dur. */
export function getLegalLinks(env: PublicEnv = readPublicEnv()): LegalLinks {
  const email = env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim();
  return {
    terms: httpUrl(env.EXPO_PUBLIC_TERMS_URL),
    privacy: httpUrl(env.EXPO_PUBLIC_PRIVACY_URL),
    community: httpUrl(env.EXPO_PUBLIC_COMMUNITY_RULES_URL),
    supportEmail: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
  };
}

export async function openExternal(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
