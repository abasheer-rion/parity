// Data that is shown at once when you come back to a page: the last copy is kept in
// memory and drawn straight away, and a fresh copy is fetched quietly behind it
// (stale-while-revalidate). The first visit shows a skeleton; later visits never flash
// empty. One fetch per key at a time, however many components ask.
import { useCallback, useEffect, useState } from "react";

interface Entry<T> { data?: T; error?: string; at: number; pending?: Promise<T> }
const store = new Map<string, Entry<unknown>>();
const listeners = new Map<string, Set<() => void>>();
const notify = (key: string) => listeners.get(key)?.forEach((l) => l());

function fetchInto<T>(key: string, load: () => Promise<T>): Promise<T> {
  const e = (store.get(key) as Entry<T> | undefined) ?? { at: 0 };
  if (e.pending) return e.pending;
  const pending = load().then(
    (data) => { store.set(key, { data, at: Date.now() }); notify(key); return data; },
    (err: Error) => { store.set(key, { ...store.get(key), error: err.message, at: Date.now(), pending: undefined }); notify(key); throw err; },
  );
  store.set(key, { ...e, pending });
  return pending;
}

/** Warm the cache before a page opens (on hover over its link, say). */
export function preload<T>(key: string, load: () => Promise<T>) {
  if (!store.get(key)?.data) fetchInto(key, load).catch(() => {});
}

/**
 * `const { data, error, loading, refresh } = useResource("search", loadSearch)`.
 * `data` is the last good copy (possibly a little old) while a new one loads; `loading`
 * is true only when there is nothing to show yet. Data younger than `maxAge` ms is not
 * fetched again.
 */
export function useResource<T>(key: string | null, load: () => Promise<T>, { maxAge = 30_000 }: { maxAge?: number } = {}) {
  const read = () => (key ? (store.get(key) as Entry<T> | undefined) : undefined);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!key) return;
    const on = () => setTick((t) => t + 1);
    let set = listeners.get(key);
    if (!set) listeners.set(key, (set = new Set()));
    set.add(on);
    const e = read();
    if (!e?.data || Date.now() - e.at > maxAge) fetchInto(key, load).catch(() => {});
    return () => { set!.delete(on); };
    // `load` is usually an inline function; the key decides what is fetched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, maxAge]);
  const refresh = useCallback(() => { if (key) fetchInto(key, load).catch(() => {}); }, [key, load]);
  const e = read();
  return { data: e?.data, error: e?.data ? undefined : e?.error, loading: !e?.data && !e?.error, refresh };
}
