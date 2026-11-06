// Variables EXPO_PUBLIC_* : Expo ne remplace que les accès statiques `process.env.EXPO_PUBLIC_NOM`.
// Ce module les lit une par une (aucun secret : ces valeurs sont incluses dans l'application).
export type PublicEnv = Record<string, string | undefined>;

export function readPublicEnv(): PublicEnv {
  return {
    EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
    EXPO_PUBLIC_REVERB_KEY: process.env.EXPO_PUBLIC_REVERB_KEY,
    EXPO_PUBLIC_REVERB_HOST: process.env.EXPO_PUBLIC_REVERB_HOST,
    EXPO_PUBLIC_REVERB_PORT: process.env.EXPO_PUBLIC_REVERB_PORT,
    EXPO_PUBLIC_REVERB_SCHEME: process.env.EXPO_PUBLIC_REVERB_SCHEME,
    EXPO_PUBLIC_REVENUECAT_IOS_KEY: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
    EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
    EXPO_PUBLIC_TERMS_URL: process.env.EXPO_PUBLIC_TERMS_URL,
    EXPO_PUBLIC_PRIVACY_URL: process.env.EXPO_PUBLIC_PRIVACY_URL,
    EXPO_PUBLIC_COMMUNITY_RULES_URL: process.env.EXPO_PUBLIC_COMMUNITY_RULES_URL,
    EXPO_PUBLIC_SUPPORT_EMAIL: process.env.EXPO_PUBLIC_SUPPORT_EMAIL,
  };
}
