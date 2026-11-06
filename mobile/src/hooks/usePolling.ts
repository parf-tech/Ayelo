import { useEffect, useRef } from 'react';

/** Appelle `callback` toutes les `intervalMs` tant que `enabled` (aucun événement temps réel n'existe pour ces données). */
export function usePolling(callback: () => void, intervalMs: number, enabled = true): void {
  const ref = useRef(callback);
  useEffect(() => {
    ref.current = callback;
  });
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => ref.current(), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);
}
