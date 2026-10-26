// Links that open a view as it was (DEC-0038). In the apps the page lives in the hash
// (#/strategy/fx_carry) and its state in the hash's query (#/search?asset=fx&q=carry),
// so a link, a bookmark or the back button reopens it. The server never sees the hash;
// src/auth/redirect.ts carries it through signing in.
import { useCallback, useEffect, useState } from "react";
import { routeMeta, SIM_TABS, type AppSpace, type LiveMeta } from "./meta";

/** The part of the hash after "?". */
export function hashQuery(hash: string = window.location.hash): URLSearchParams {
  return new URLSearchParams(hash.split("?")[1] ?? "");
}

/** The hash with some query values changed; empty values are dropped. */
export function withHashQuery(hash: string, patch: Record<string, string | null | undefined>): string {
  const [path, q = ""] = hash.split("?");
  const p = new URLSearchParams(q);
  for (const [k, v] of Object.entries(patch)) {
    if (v == null || v === "") p.delete(k);
    else p.set(k, v);
  }
  const s = p.toString();
  return `${path || "#/"}${s ? `?${s}` : ""}`;
}

/** Changes the hash query in place: no new history entry, no hashchange, no jump. */
export function setHashQuery(patch: Record<string, string | null | undefined>) {
  const next = withHashQuery(window.location.hash, patch);
  if (next !== window.location.hash) window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}${next}`);
}

/** A piece of view state kept in the hash query, read once on open and written on change. */
export function useHashState(key: string, fallback = ""): [string, (v: string) => void] {
  const [value, setValue] = useState(() => hashQuery().get(key) ?? fallback);
  const set = useCallback((v: string) => {
    setValue(v);
    setHashQuery({ [key]: v === fallback ? null : v });
  }, [key, fallback]);
  return [value, set];
}

/** The same for an on/off switch, kept as key=1. */
export function useHashFlag(key: string): [boolean, (v: boolean) => void] {
  const [value, set] = useHashState(key);
  return [value === "1", useCallback((v: boolean) => set(v ? "1" : ""), [set])];
}

// ---------------------------------------------------------------- short links

/**
 * The shortest stable link to a view: /s/<id> for a strategy (it shares with that
 * strategy's card), /sim/<tab> for a Terminal workspace, otherwise the address as it is.
 */
export function shareUrl(href: string = window.location.href): string {
  let url: URL;
  try { url = new URL(href); } catch { return href; }
  const [path, query] = url.hash.split("?");
  const parts = path.replace(/^#\/?/, "").split("/");
  if (url.pathname === "/app/" && parts[0] === "strategy" && parts[1] && !query) {
    return `${url.origin}/s/${parts[1]}`;
  }
  const onSim = url.pathname === "/sim/" || (url.hostname.startsWith("sim.") && url.pathname === "/");
  if (onSim && SIM_TABS[parts[0]] && !parts[1]) {
    return `${url.origin}/sim/${parts[0]}${query ? `?${query}` : ""}`;
  }
  return url.toString();
}

// ---------------------------------------------------------------- live tags

function setMeta(attr: "name" | "property", key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = value;
}

/** Updates the tab title and the share tags for the page now showing. */
export function applyMeta(m: LiveMeta, href: string = window.location.href) {
  document.title = m.title;
  setMeta("name", "description", m.description);
  setMeta("property", "og:title", m.title);
  setMeta("property", "og:description", m.description);
  setMeta("property", "og:url", href);
  setMeta("property", "og:image", m.image);
  setMeta("name", "twitter:title", m.title);
  setMeta("name", "twitter:description", m.description);
  setMeta("name", "twitter:image", m.image);
}

/** Keeps the title and share tags in step with the in-app page. */
export function useRouteMeta(space: AppSpace, route: string, arg?: string, name?: string) {
  useEffect(() => {
    applyMeta(routeMeta(space, route, arg, name));
  }, [space, route, arg, name]);
}
