import { useCallback, useEffect, useRef, useState } from 'react';
import type { Page } from '../api/types';
import type { ResourceStatus } from './useResource';

export type Paginated<T> = {
  status: ResourceStatus;
  items: T[];
  error: unknown;
  hasMore: boolean;
  loadingMore: boolean;
  /** Erreur de la dernière page demandée (les pages déjà chargées restent affichées). */
  moreError: unknown;
  loadMore: () => Promise<void>;
  /** Recharge depuis la première page. `silent` garde la liste affichée pendant la requête. */
  refresh: (options?: { silent?: boolean }) => Promise<void>;
  setItems: (updater: (previous: T[]) => T[]) => void;
};

/** Liste paginée par curseur (`next_cursor`). Les doublons (même clé) sont ignorés. */
export function usePaginated<T>(
  fetchPage: (cursor: string | undefined) => Promise<Page<T>>,
  getKey: (item: T) => string,
  deps: readonly unknown[] = [],
): Paginated<T> {
  const [status, setStatus] = useState<ResourceStatus>('loading');
  const [items, setItemsState] = useState<T[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [moreError, setMoreError] = useState<unknown>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const fetchRef = useRef(fetchPage);
  const keyRef = useRef(getKey);
  const mounted = useRef(true);
  const seq = useRef(0);
  const busyMore = useRef(false);

  useEffect(() => {
    fetchRef.current = fetchPage;
    keyRef.current = getKey;
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    const mine = ++seq.current;
    const silent = Boolean(options?.silent);
    if (!silent) {
      setStatus('loading');
      setError(null);
    }
    try {
      const page = await fetchRef.current(undefined);
      if (!mounted.current || mine !== seq.current) return;
      setItemsState(page.data);
      setCursor(page.next_cursor);
      setMoreError(null);
      setStatus('ready');
    } catch (e) {
      if (!mounted.current || mine !== seq.current) return;
      if (silent) return;
      setError(e);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const loadMore = useCallback(async () => {
    if (!cursor || busyMore.current) return;
    busyMore.current = true;
    setLoadingMore(true);
    setMoreError(null);
    const mine = seq.current;
    try {
      const page = await fetchRef.current(cursor);
      if (!mounted.current || mine !== seq.current) return;
      setItemsState((previous) => {
        const known = new Set(previous.map((item) => keyRef.current(item)));
        return [...previous, ...page.data.filter((item) => !known.has(keyRef.current(item)))];
      });
      setCursor(page.next_cursor);
    } catch (e) {
      if (mounted.current) setMoreError(e);
    } finally {
      busyMore.current = false;
      if (mounted.current) setLoadingMore(false);
    }
  }, [cursor]);

  const setItems = useCallback((updater: (previous: T[]) => T[]) => setItemsState(updater), []);

  return { status, items, error, hasMore: cursor !== null, loadingMore, moreError, loadMore, refresh, setItems };
}
