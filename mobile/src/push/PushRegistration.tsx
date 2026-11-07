import { usePushRegistration } from './registerPush';

/** Composant sans rendu : à placer sous <AuthProvider>. */
export function PushRegistration() {
  usePushRegistration();
  return null;
}
