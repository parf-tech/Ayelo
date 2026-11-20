import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n';
import { appStorage } from '../storage';
import { authenticate, isBiometricAvailable } from './biometrics';

/** Durée hors de l'application au-delà de laquelle elle se verrouille (décision du propriétaire, 2026-11-20). */
export const LOCK_DELAY_MS = 60_000;

export type BiometricOutcome = 'ok' | 'cancelled' | 'failed' | 'unsupported';

export type BiometricLockValue = {
  /** Préférence et capacités lues : avant, rien n'est verrouillé ni proposé. */
  ready: boolean;
  /** L'appareil a un verrouillage (biométrie ou code) : sinon l'option n'est pas proposée. */
  supported: boolean;
  enabled: boolean;
  /** L'écran de verrouillage couvre l'application. */
  locked: boolean;
  /** Active ou désactive le verrou, après confirmation par l'appareil. */
  setEnabled: (on: boolean) => Promise<BiometricOutcome>;
  /** Relance l'invite de déverrouillage. */
  unlock: () => Promise<boolean>;
  /** Confirmation avant une action sensible : vraie si le verrou est désactivé, ou si la personne s'authentifie. */
  confirm: () => Promise<boolean>;
};

/** Sans fournisseur (écrans isolés, tests) : rien n'est proposé, rien ne bloque. */
const NO_LOCK: BiometricLockValue = {
  ready: true,
  supported: false,
  enabled: false,
  locked: false,
  setEnabled: async () => 'unsupported',
  unlock: async () => true,
  confirm: async () => true,
};

export const BiometricLockContext = createContext<BiometricLockValue>(NO_LOCK);

export function useBiometricLock(): BiometricLockValue {
  return useContext(BiometricLockContext);
}

/**
 * Verrouillage de l'application par biométrie (Face ID, empreinte) avec repli sur le code de l'appareil.
 *  - Option désactivée par défaut, mémorisée sur l'appareil (stockage sécurisé), effacée à la déconnexion.
 *  - Verrouillé au démarrage à froid, puis après `LOCK_DELAY_MS` en arrière-plan. L'état « inactive » ne compte pas (l'invite
 *    système de Face ID le provoque) et les changements d'état pendant une invite sont ignorés.
 *  - Une seule invite par verrouillage : annulée, l'écran reste verrouillé et « Déverrouiller » réessaie.
 *  - L'appareil n'a plus de verrouillage : l'application ne peut plus rien imposer, le verrou est levé et désactivé.
 */
export function BiometricLockProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const { state } = useAuth();
  const signedIn = state.status === 'signedIn';
  const signedOut = state.status === 'signedOut';

  const [ready, setReady] = useState(false);
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabledState] = useState(false);
  const [lockFlag, setLockFlag] = useState(false);
  const [epoch, setEpoch] = useState(0);

  const authenticating = useRef(false);
  const backgroundedAt = useRef<number | null>(null);
  const promptedEpoch = useRef(0);
  const latest = useRef({ enabled, signedIn, signedOut });

  useEffect(() => {
    latest.current = { enabled, signedIn, signedOut };
  });

  // Passage à « déconnecté » (fin de session, ou pas de session au démarrage) : la préférence ne suit pas à un autre compte.
  // État dérivé pendant le rendu, plutôt que dans un effet (pas de rendu en cascade).
  const [wasSignedOut, setWasSignedOut] = useState(signedOut);
  if (signedOut !== wasSignedOut) {
    setWasSignedOut(signedOut);
    if (signedOut) {
      setEnabledState(false);
      setLockFlag(false);
    }
  }

  // Préférence et capacités, une fois.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const [stored, available] = await Promise.all([appStorage.getBiometricLock(), isBiometricAvailable()]);
      if (stored && !available) await appStorage.setBiometricLock(false); // l'appareil n'a plus de verrouillage
      if (!alive) return;
      setSupported(available);
      const on = stored && available && !latest.current.signedOut;
      setEnabledState(on);
      if (on) {
        setLockFlag(true); // démarrage à froid : verrouillé tant que la personne n'est pas authentifiée
        setEpoch((e) => e + 1);
      }
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Déconnecté : la préférence mémorisée est effacée (l'état local est remis à zéro pendant le rendu, plus haut).
  useEffect(() => {
    if (!signedOut || !ready) return;
    void appStorage.setBiometricLock(false);
    backgroundedAt.current = null;
  }, [signedOut, ready]);

  // Retour au premier plan après LOCK_DELAY_MS.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (authenticating.current) return;
      if (next === 'background') {
        backgroundedAt.current = Date.now();
        return;
      }
      if (next !== 'active') return;
      const since = backgroundedAt.current;
      backgroundedAt.current = null;
      if (since !== null && latest.current.enabled && latest.current.signedIn && Date.now() - since >= LOCK_DELAY_MS) {
        setLockFlag(true);
        setEpoch((e) => e + 1);
      }
    });
    return () => subscription.remove();
  }, []);

  const labels = useCallback((prompt: string) => ({ prompt, cancel: t('common.cancel') }), [t]);

  const disable = useCallback(async () => {
    await appStorage.setBiometricLock(false);
    setEnabledState(false);
    setLockFlag(false);
  }, []);

  const unlock = useCallback(async () => {
    if (authenticating.current) return false;
    authenticating.current = true;
    try {
      const result = await authenticate(labels(t('biometric.prompt.unlock')));
      if (result === 'success') {
        setLockFlag(false);
        return true;
      }
      if (result === 'unavailable') {
        await disable(); // plus de verrouillage sur l'appareil : rien à imposer
        return true;
      }
      return false;
    } finally {
      authenticating.current = false;
    }
  }, [disable, labels, t]);

  const locked = ready && enabled && signedIn && lockFlag;

  // Une invite automatique par verrouillage, session ouverte seulement.
  useEffect(() => {
    if (!locked || promptedEpoch.current === epoch) return;
    promptedEpoch.current = epoch;
    void unlock();
  }, [locked, epoch, unlock]);

  const setEnabled = useCallback(
    async (on: boolean): Promise<BiometricOutcome> => {
      if (authenticating.current) return 'failed';
      if (on && !supported) return 'unsupported';
      authenticating.current = true;
      try {
        const result = await authenticate(labels(t(on ? 'biometric.prompt.enable' : 'biometric.prompt.disable')));
        if (result === 'cancelled') return 'cancelled';
        if (result === 'failed') return 'failed';
        if (result === 'unavailable') {
          if (on) return 'unsupported';
          await disable();
          return 'ok';
        }
        if (!on) {
          await disable();
          return 'ok';
        }
        try {
          await appStorage.setBiometricLock(true);
        } catch {
          return 'failed'; // non mémorisé : le verrou ne doit pas sembler actif
        }
        setEnabledState(true);
        setLockFlag(false);
        return 'ok';
      } finally {
        authenticating.current = false;
      }
    },
    [disable, labels, supported, t],
  );

  const confirm = useCallback(async () => {
    if (!enabled) return true;
    if (authenticating.current) return false;
    authenticating.current = true;
    try {
      const result = await authenticate(labels(t('biometric.prompt.sensitive')));
      // « indisponible » : plus de verrouillage sur l'appareil, rien à imposer (le serveur exige toujours le mot de passe).
      return result === 'success' || result === 'unavailable';
    } finally {
      authenticating.current = false;
    }
  }, [enabled, labels, t]);

  const value = useMemo<BiometricLockValue>(
    () => ({ ready, supported, enabled, locked, setEnabled, unlock, confirm }),
    [ready, supported, enabled, locked, setEnabled, unlock, confirm],
  );

  return <BiometricLockContext.Provider value={value}>{children}</BiometricLockContext.Provider>;
}
