import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Keyboard, KeyboardEvent, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../i18n';
import { elevation, MAX_CONTENT_WIDTH, useTheme, zIndex } from '../theme';
import { announce } from './a11y/announce';
import { Banner, BannerVariant, bannerTypeKey } from './Banner';

export type ToastOptions = {
  message: string;
  variant?: BannerVariant;
  /** Durée d'affichage. Sans valeur : selon le type (voir `toastDurationMs`) ; persistant si une action est proposée. */
  durationMs?: number;
  /** Action facultative (ex. « Voir » après un nouveau match). */
  actionLabel?: string;
  onAction?: () => void;
};

type ToastApi = {
  show: (options: ToastOptions) => void;
  hide: () => void;
  /** Espace réservé sous le toast (barre d'onglets visible). `0` quand elle disparaît. Voir `TAB_BAR_MIN_HEIGHT`. */
  setBottomOffset: (offset: number) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

/** Durées par défaut (WCAG 2.2.1 : le temps de lecture d'un message utile ne se compte pas en secondes courtes). */
export const SUCCESS_TOAST_DURATION_MS = 6000;
export const WARNING_TOAST_DURATION_MS = 8000;
export const ERROR_TOAST_DURATION_MS = 10000;
/** Plancher d'un toast qui porte une action : le temps de la lire et de la toucher. */
export const ACTION_TOAST_MIN_DURATION_MS = 10000;
/** Temps de lecture : 3 s de prise en main plus 60 ms par caractère (environ 17 caractères par seconde), plafonné à 30 s. */
export const TOAST_READING_BASE_MS = 3000;
export const TOAST_READING_MS_PER_CHAR = 60;
export const TOAST_MAX_DURATION_MS = 30000;

/** Hauteur minimale de la barre d'onglets (`MainTabs`) : le toast se pose au-dessus. */
export const TAB_BAR_MIN_HEIGHT = 56;

/**
 * Durée d'affichage d'un toast, ou `null` s'il reste jusqu'à fermeture.
 * Plancher selon le type (erreur 10 s, avertissement 8 s, succès et information 6 s), prolongé pour un message long
 * (temps de lecture, 30 s au plus) ; avec une action : sans limite (fermeture manuelle ou action), et jamais moins de
 * 10 s si l'appelant impose une durée. Une durée imposée sans action est respectée telle quelle.
 */
export function toastDurationMs(options: Pick<ToastOptions, 'variant' | 'durationMs' | 'actionLabel'> & { message?: string }): number | null {
  const hasAction = Boolean(options.actionLabel);
  if (options.durationMs !== undefined) {
    return hasAction ? Math.max(options.durationMs, ACTION_TOAST_MIN_DURATION_MS) : options.durationMs;
  }
  if (hasAction) return null;
  const reading = Math.min(TOAST_MAX_DURATION_MS, TOAST_READING_BASE_MS + TOAST_READING_MS_PER_CHAR * (options.message?.length ?? 0));
  switch (options.variant) {
    case 'error':
      return Math.max(ERROR_TOAST_DURATION_MS, reading);
    case 'warning':
      return Math.max(WARNING_TOAST_DURATION_MS, reading);
    default:
      return Math.max(SUCCESS_TOAST_DURATION_MS, reading);
  }
}

/** Vrai quand un lecteur d'écran est actif (lu par `show`, sans rendu à chaque changement). */
function useScreenReaderRef(): React.MutableRefObject<boolean> {
  const active = useRef(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((enabled) => {
        if (alive) active.current = enabled;
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', (enabled) => {
      active.current = enabled;
    });
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);
  return active;
}

/** Hauteur du clavier visible (0 sinon), pour poser le toast au-dessus. */
function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = Keyboard.addListener(show, (event: KeyboardEvent) => setHeight(event.endCoordinates.height));
    const onHide = Keyboard.addListener(hide, () => setHeight(0));
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);
  return height;
}

/** Toasts non bloquants : un seul à la fois, disparition automatique selon le type et la longueur du message (jamais avec un lecteur d'écran), fermeture manuelle possible. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastOptions | null>(null);
  const [bottomOffset, setBottomOffset] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const screenReader = useScreenReaderRef();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const { space } = useTheme();
  const { t } = useI18n();

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setToast(null);
  }, []);

  const show = useCallback(
    (options: ToastOptions) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      setToast(options);
      announce(`${t(bannerTypeKey(options.variant ?? 'info'))}. ${options.message}`);
      // Lecteur d'écran actif : jamais de fermeture automatique (WCAG 2.2.1), la personne ferme le toast elle-même.
      const duration = screenReader.current ? null : toastDurationMs(options);
      if (duration !== null) timer.current = setTimeout(hide, duration);
    },
    [hide, screenReader, t],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const api = useMemo(() => ({ show, hide, setBottomOffset }), [show, hide]);

  // Au-dessus du clavier s'il est ouvert, sinon au-dessus de la barre d'onglets et de la zone sûre.
  const bottom = (keyboardHeight > 0 ? keyboardHeight : insets.bottom + bottomOffset) + space[4];

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast ? (
        <View pointerEvents="box-none" style={[styles.host, { bottom, left: space[4], right: space[4], zIndex: zIndex.toast }]}>
          <View pointerEvents="box-none" style={styles.inner}>
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
              style={elevation[2]}
            />
          </View>
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

/**
 * Réserve `offset` pt sous les toasts tant que l'appelant est monté (barre d'onglets visible).
 * Sans `<ToastProvider>` (écran rendu seul) : sans effet.
 */
export function useToastBottomOffset(offset: number): void {
  const setBottomOffset = useContext(ToastContext)?.setBottomOffset;
  useEffect(() => {
    if (!setBottomOffset) return undefined;
    setBottomOffset(offset);
    return () => setBottomOffset(0);
  }, [setBottomOffset, offset]);
}

const styles = StyleSheet.create({
  host: { position: 'absolute' },
  inner: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
});
