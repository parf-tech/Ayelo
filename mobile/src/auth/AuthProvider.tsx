import { Platform } from 'react-native';
import Constants from 'expo-constants';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import { Api, createApiClient, createEndpoints, getConfiguredBaseUrl, isApiError } from '../api';
import type { ApiLocale, AuthResponse, Me, Platform as ApiPlatform } from '../api/types';
import { useI18n } from '../i18n';
import { getActiveLocale } from '../i18n/activeLocale';
import { appStorage, getDeviceId, tokenStore } from '../storage';
import { authReducer, AuthState, initialAuthState } from './authState';
import { setSessionNotice } from './sessionNotice';

export type AuthContextValue = {
  state: AuthState;
  api: Api;
  /** Enregistre le jeton (expo-secure-store) et ouvre la session. `isNewAccount` déclenche l'onboarding. */
  signIn: (response: AuthResponse, options?: { isNewAccount?: boolean }) => Promise<void>;
  /** Révoque le jeton côté serveur (au mieux) puis efface la session locale. */
  signOut: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  /** Recharge GET /me (profil, crédits, Premium). Renvoie null si la requête échoue (l'état précédent est conservé). */
  refreshMe: () => Promise<Me | null>;
  clientInfo: { platform: ApiPlatform; appVersion: string; locale: ApiLocale };
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function currentPlatform(): ApiPlatform {
  return Platform.OS === 'ios' ? 'ios' : 'android';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialAuthState);
  const { locale } = useI18n();

  /** Efface la session locale (jeton, onboarding en attente) et revient à l'état déconnecté. */
  const clearSession = useCallback(async () => {
    await tokenStore.clear();
    await appStorage.setOnboardingPending(false);
    dispatch({ type: 'SIGNED_OUT' });
  }, []);

  /** Le serveur a refusé le jeton : l'accueil l'explique (BUG-001). Une déconnexion voulue passe par signOut, sans ce message. */
  const expireSession = useCallback(async () => {
    setSessionNotice(true);
    await clearSession();
  }, [clearSession]);

  const api = useMemo(
    () =>
      createEndpoints(
        createApiClient({
          baseUrl: getConfiguredBaseUrl,
          getDeviceId,
          getToken: () => tokenStore.get(),
          getLocale: getActiveLocale,
          // 401 sur une requête authentifiée : la session n'est plus valable.
          onUnauthorized: () => {
            void expireSession();
          },
        }),
      ),
    [expireSession],
  );

  // Restauration de la session au lancement.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await tokenStore.get();
      if (!token) {
        if (!cancelled) dispatch({ type: 'RESTORED', signedIn: false, user: null, onboardingPending: false });
        return;
      }
      const onboardingPending = await appStorage.getOnboardingPending();
      try {
        const me = await api.auth.me();
        if (!cancelled) dispatch({ type: 'RESTORED', signedIn: true, user: me, onboardingPending });
      } catch (error) {
        if (cancelled) return;
        if (isApiError(error) && error.isUnauthorized) {
          // onUnauthorized a déjà effacé la session ; on s'assure de sortir de l'état « loading ».
          dispatch({ type: 'RESTORED', signedIn: false, user: null, onboardingPending: false });
        } else {
          // Réseau coupé ou serveur indisponible : on garde la session (jeton conservé), profil rechargé plus tard.
          dispatch({ type: 'RESTORED', signedIn: true, user: null, onboardingPending });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  const signIn = useCallback<AuthContextValue['signIn']>(async (response, options) => {
    const isNewAccount = Boolean(options?.isNewAccount);
    await tokenStore.set(response.token);
    await appStorage.setOnboardingPending(isNewAccount);
    setSessionNotice(false);
    dispatch({ type: 'SIGNED_IN', user: response.user, isNewAccount });
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      // Hors ligne ou jeton déjà invalide : on efface quand même la session locale.
    }
    // Déconnexion voulue : pas de message « session expirée », même si le serveur a répondu 401 à la révocation.
    setSessionNotice(false);
    await clearSession();
  }, [api, clearSession]);

  const completeOnboarding = useCallback(async () => {
    await appStorage.setOnboardingPending(false);
    dispatch({ type: 'ONBOARDING_DONE' });
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const me = await api.auth.me();
      dispatch({ type: 'USER_LOADED', user: me });
      return me;
    } catch {
      return null;
    }
  }, [api]);

  const clientInfo = useMemo(
    () => ({
      platform: currentPlatform(),
      appVersion: Constants.expoConfig?.version ?? '0.0.0',
      locale: locale as ApiLocale,
    }),
    [locale],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ state, api, signIn, signOut, completeOnboarding, refreshMe, clientInfo }),
    [state, api, signIn, signOut, completeOnboarding, refreshMe, clientInfo],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé sous <AuthProvider>.');
  return ctx;
}
