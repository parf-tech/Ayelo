// Les clés SecureStore n'acceptent que [A-Za-z0-9._-].
export const STORAGE_KEYS = {
  authToken: 'ayelo.auth_token',
  deviceId: 'ayelo.device_id',
  locale: 'ayelo.locale',
  onboardingPending: 'ayelo.onboarding_pending',
  biometricLock: 'ayelo.biometric_lock',
} as const;
