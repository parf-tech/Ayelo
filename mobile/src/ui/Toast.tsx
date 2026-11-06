import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../i18n';
import { Banner, BannerVariant } from './Banner';

export type ToastOptions = {
  message: string;
  variant?: BannerVariant;
  durationMs?: number;
  /** Action facultative (ex. « Voir » après un nouveau match). */
  actionLabel?: string;
  onAction?: () => void;
};

type ToastApi = { show: (options: ToastOptions) => void; hide: () => void };

const ToastContext = createContext<ToastApi | null>(null);

export const DEFAULT_TOAST_DURATION_MS = 4000;

/** Toasts non bloquants : un seul à la fois, disparition automatique, fermeture manuelle possible. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastOptions | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setToast(null);
  }, []);

  const show = useCallback(
    (options: ToastOptions) => {
      if (timer.current) clearTimeout(timer.current);
      setToast(options);
      timer.current = setTimeout(hide, options.durationMs ?? DEFAULT_TOAST_DURATION_MS);
    },
    [hide],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const api = useMemo(() => ({ show, hide }), [show, hide]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast ? (
        <View pointerEvents="box-none" style={[styles.host, { bottom: insets.bottom + 16 }]}>
          <Banner
            testID="toast"
            message={toast.message}
            variant={toast.variant ?? 'info'}
            actionLabel={toast.actionLabel}
            onAction={
              toast.onAction
                ? () => {
                    hide();
                    toast.onAction?.();
                  }
                : undefined
            }
            onDismiss={hide}
            dismissLabel={t('ui.toast.dismiss')}
          />
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast doit être utilisé sous <ToastProvider>.');
  return ctx;
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 16, right: 16 },
});
