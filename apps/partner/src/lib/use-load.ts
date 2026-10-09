import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

// Small data-loading hook: loads when the screen gains focus (so lists are fresh after editing on
// another screen) and whenever `deps` change, supports pull-to-refresh, and ignores results that
// arrive late (after unmount, or after a newer request).

export interface LoadState<T> {
  data: T | undefined;
  error: unknown;
  /** First load in progress (no data yet). */
  loading: boolean;
  /** Pull-to-refresh in progress. */
  refreshing: boolean;
  /** Reload in the background, keeping current data on screen. Stable across renders. */
  reload: () => Promise<void>;
  /** Reload showing the pull-to-refresh spinner. */
  refresh: () => Promise<void>;
}

export function useLoad<T>(loader: () => Promise<T>, deps: readonly unknown[]): LoadState<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);
  const latest = useRef(0);
  // Always call the newest loader (it closes over the current props/state).
  const loaderRef = useRef(loader);

  useEffect(() => {
    loaderRef.current = loader;
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    const request = ++latest.current;
    const isCurrent = () => mounted.current && request === latest.current;
    try {
      const result = await loaderRef.current();
      if (isCurrent()) {
        setData(result);
        setError(null);
      }
    } catch (e) {
      if (isCurrent()) setError(e);
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    if (mounted.current) setRefreshing(false);
  }, [reload]);

  // Load whenever the screen gains focus...
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  // ...and again when the inputs (deps) change while it is focused.
  const key = JSON.stringify(deps);
  const loadedKey = useRef(key);
  useEffect(() => {
    if (loadedKey.current === key) return;
    loadedKey.current = key;
    reload();
  }, [key, reload]);

  return { data, error, loading, refreshing, reload, refresh };
}

/** The data type of a supabase-js response's success branch (row, row | null, or rows). */
type SuccessData<R> = Extract<R, { error: null }> extends { data: infer D } ? D : never;

/**
 * Throws a Supabase/PostgREST error so useLoad (or a try/catch) can handle it; returns the data
 * otherwise: the row for .single(), row | null for .maybeSingle(), rows for lists.
 */
export function unwrap<R extends { data: unknown; error: unknown }>(result: R): SuccessData<R> {
  if (result.error) throw result.error;
  return result.data as SuccessData<R>;
}
