import { useCallback, useEffect, useRef, useState } from 'react';

export type ResourceStatus = 'loading' | 'ready' | 'error';

export type Resource<T> = {
  status: ResourceStatus;
  data: T | null;
  error: unknown;
  /** Recharge. `silent` conserve les données affichées pendant la requête (rafraîchissement discret). */
  reload: (options?: { silent?: boolean }) => Promise<void>;
  setData: (updater: T | null | ((previous: T | null) => T | null)) => void;
};

/**
 * Charge une ressource (une requête) avec états loading / ready / error.
 * `deps` relance le chargement quand elles changent ; en cas d'échec d'un rechargement discret,
 * les données déjà affichées sont conservées.
 */
export function useResource<T>(load: () => Promise<T>, deps: readonly unknown[] = []): Resource<T> {
  const [status, setStatus] = useState<ResourceStatus>('loading');
  const [data, setDataState] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const loadRef = useRef(load);
  const mounted = useRef(true);
  const seq = useRef(0);

  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (silent: boolean) => {
    const mine = ++seq.current;
    if (!silent) {
      setStatus('loading');
      setError(null);
    }
    try {
      const result = await loadRef.current();
      if (!mounted.current || mine !== seq.current) return;
      setDataState(result);
      setStatus('ready');
      setError(null);
    } catch (e) {
      if (!mounted.current || mine !== seq.current) return;
      if (silent) return;
      setError(e);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    // Chargement initial : l'état « loading » est posé de façon synchrone, par conception.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void run(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const reload = useCallback((options?: { silent?: boolean }) => run(Boolean(options?.silent)), [run]);

  const setData = useCallback<Resource<T>['setData']>((updater) => {
    setDataState((previous) =>
      typeof updater === 'function' ? (updater as (p: T | null) => T | null)(previous) : updater,
    );
  }, []);

  return { status, data, error, reload, setData };
}
