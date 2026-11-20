import { usePushReception } from './usePushReception';

/** Composant sans rendu : à placer sous <AuthProvider>, dans la mise en page racine. */
export function PushReception() {
  usePushReception();
  return null;
}
