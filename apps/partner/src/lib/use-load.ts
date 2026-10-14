import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

// Small data-loading hook: loads when the screen gains focus (so lists are fresh after editing on
// another screen) and whenever `deps` change, supports pull-to-refresh, and ignores results that
// arrive late (after unmount, or after a newer request).
//
// With `cache`, results are kept in memory keyed by `cache` + `deps`, so reopening a screen (or
// going back to a day already viewed) shows the last data instantly while it refreshes in the
// background, instead of a full-screen spinner. The cache is cleared on sign-out. Use it for lists
// and read-only screens, not for edit forms: a form copies its data once, so it must start fresh.

const cache = new Map<string, unknown>();

/** Forget every cached result. Called on sign-out so one user's data never shows for another. */
export function clearLoadCache() {
  cache.clear();
}

function cacheKey(key: string, deps: readonly unknown[]) {
  return `${key}:${JSON.stringify(deps)}`;
}

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
  /**
   * Change the data locally (and in the cache) without a request, e.g. an optimistic update or
   * merging the row a mutation returned. Stable across renders.
   */
  mutate: (update: (current: T | undefined) => T | undefined) => void;
}

export interface LoadOptions {
  /** Names this query in the cache (e.g. 'bookings'); together with `deps` it must identify the data. */
  cache?: string;
}

export function useLoad<T>(loader: () => Promise<T>, deps: readonly unknown[], options: LoadOptions = {}): LoadState<T> {
  // Without a cache name the key only tracks dep changes; nothing is read from or written to the cache.
  const fullKey = options.cache ? cacheKey(options.cache, deps) : JSON.stringify(deps);
  const cached = options.cache !== undefined;
  const cachedRef = useRef(cached);
  const [data, setData] = useState<T | undefined>(() => (cached ? (cache.get(fullKey) as T | undefined) : undefined));
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(() => !(cached && cache.has(fullKey)));
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);
  const latest = useRef(0);
  // Always call the newest loader (it closes over the current props/state).
  const loaderRef = useRef(loader);
  const keyRef = useRef(fullKey);

  useEffect(() => {
    loaderRef.current = loader;
    cachedRef.current = cached;
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    const request = ++latest.current;
    const requestKey = keyRef.current;
    const isCurrent = () => mounted.current && request === latest.current;
    try {
      const result = await loaderRef.current();
      if (cachedRef.current) cache.set(requestKey, result);
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

  const mutate = useCallback((update: (current: T | undefined) => T | undefined) => {
    setData((current) => {
      const next = update(current);
      if (cachedRef.current) {
        if (next === undefined) cache.delete(keyRef.current);
        else cache.set(keyRef.current, next);
      }
      return next;
    });
  }, []);

  // Load whenever the screen gains focus...
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  // ...and again when the inputs (deps) change while it is focused. Show what is cached for the
  // new inputs straight away; with nothing cached, keep the old data until the new data arrives.
  useEffect(() => {
    if (keyRef.current === fullKey) return;
    keyRef.current = fullKey;
    if (cachedRef.current && cache.has(fullKey)) setData(cache.get(fullKey) as T);
    reload();
  }, [fullKey, reload]);

  return { data, error, loading, refreshing, reload, refresh, mutate };
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
