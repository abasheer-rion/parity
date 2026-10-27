// One shared copy of the person's personalization state per page, so the feed, the widgets
// and the settings page ask the database once. reload() after any change.
import { useEffect, useState } from "react";
import { getPersonal, type Personal } from "./api";

let cache: Promise<Personal | null> | null = null;
const listeners = new Set<(p: Personal | null) => void>();

export function loadPersonal(force = false): Promise<Personal | null> {
  if (!cache || force) {
    cache = getPersonal();
    void cache.then((p) => { for (const f of listeners) f(p); });
  }
  return cache;
}

/** Asks again and tells every user of the hook. */
export const reloadPersonal = () => loadPersonal(true);

/** undefined while loading, null when signed out or unavailable. */
export function usePersonal(): Personal | null | undefined {
  const [p, setP] = useState<Personal | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    const on = (v: Personal | null) => { if (live) setP(v); };
    listeners.add(on);
    void loadPersonal().then(on);
    return () => { live = false; listeners.delete(on); };
  }, []);
  return p;
}
