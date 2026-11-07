import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../auth/AuthProvider';
import { isApiError, type Api } from '../api';

const ANDROID_CHANNEL_ID = 'default';

/**
 * Obtient le jeton natif de l'appareil (FCM sur Android, APNs sur iOS) et l'envoie à `PUT /me/device`.
 * Le serveur envoie directement via FCM : on utilise donc le jeton d'appareil, pas un jeton Expo Push.
 * Meilleur effort : aucune exception ne remonte (refus de la permission, simulateur, réseau, conflit 409).
 * La permission n'est demandée qu'ici ; l'appelant doit avoir vérifié le consentement et l'onboarding.
 * Renvoie le jeton enregistré, ou null.
 */
export async function registerForPush(api: Pick<Api, 'notifications'>): Promise<string | null> {
  try {
    if (!Device.isDevice) return null; // pas de jeton sur simulateur ou émulateur

    if (Platform.OS === 'android') {
      // Le canal doit exister avant la demande de permission (Android 13+).
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: 'Ayelo',
        // eslint-disable-next-line import/namespace -- enum exporté via `export *` que la règle ne résout pas
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    let { status, canAskAgain } = await Notifications.getPermissionsAsync();
    if (status !== 'granted' && canAskAgain) {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return null;

    const { data } = await Notifications.getDevicePushTokenAsync();
    if (typeof data !== 'string' || data.length === 0) return null;
    await sendToken(api, data);
    return data;
  } catch (error) {
    // 409 push_token_in_use : jeton déjà porté par un autre compte sur un autre appareil. Non fatal :
    // aucune nouvelle tentative, aucun message à l'utilisateur, trace en développement seulement.
    if (__DEV__ && isApiError(error) && error.status === 409) {
      console.warn('[push] jeton déjà utilisé par un autre compte (push_token_in_use), non enregistré.');
    }
    return null;
  }
}

async function sendToken(api: Pick<Api, 'notifications'>, token: string): Promise<void> {
  await api.notifications.registerDevice({
    push_token: token,
    app_version: Constants.expoConfig?.version ?? '0.0.0',
  });
}

/**
 * Enregistre l'appareil pour les notifications push une fois la session ouverte ET l'onboarding terminé
 * (la majorité et les consentements sont acquis à ce stade). Rien n'est demandé hors session ; à la
 * déconnexion le serveur efface le jeton (`POST /auth/logout`) et le suivi local est remis à zéro.
 */
export function usePushRegistration(): void {
  const { state, api } = useAuth();
  const ready = state.status === 'signedIn' && !state.onboardingPending;
  const started = useRef(false);

  useEffect(() => {
    if (!ready) {
      started.current = false;
      return;
    }
    if (started.current) return;
    started.current = true;
    void registerForPush(api);

    // Rotation du jeton par le système : on renvoie le nouveau jeton.
    const subscription = Notifications.addPushTokenListener((token) => {
      if (typeof token.data === 'string' && token.data.length > 0) {
        void sendToken(api, token.data).catch(() => undefined);
      }
    });
    return () => subscription.remove();
  }, [ready, api]);
}
