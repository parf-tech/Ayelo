/**
 * Étapes d'onboarding, dans l'ordre : S04 profil, S05 intention, S06 photos, S07 préférences.
 * (S03, la vérification de l'e-mail, n'est pas comptée : non bloquante.) Source unique du Stepper : l'indicateur
 * d'étapes affiche exactement ces étapes, sans en inventer.
 */
export const ONBOARDING_STEP_KEYS = ['profile', 'intent', 'photos', 'preferences'] as const;
export type OnboardingStepKey = (typeof ONBOARDING_STEP_KEYS)[number];

export const ONBOARDING_STEPS = ONBOARDING_STEP_KEYS.length;

/** Numéro (1..4) d'une étape. */
export function onboardingStepNumber(step: OnboardingStepKey): number {
  return ONBOARDING_STEP_KEYS.indexOf(step) + 1;
}
