// Shared terminal state: the data every panel reads, the linked selection (a series, a
// currency, a strategy) that panels follow, and the sim settings Sim World's tabs share.
import { createContext, useContext, useEffect, useState } from "react";
import type { Spec } from "../lib/scenarios";
import type { Report, StrategyRun } from "../lib/types";
import type { Loadable, TermIndex, TermSeries } from "./data";
import type { Leaf } from "./layout";

export interface Link { series?: string; ccy?: string; strategy?: string }

export interface TermCtx {
  index: Loadable<TermIndex>;
  report: Loadable<Report>;
  link: Link;
  setLink: (patch: Link) => void;
  /** Run a command line in the focused panel, or in a new panel. */
  run: (line: string, opts?: { newPanel?: boolean }) => boolean;
  /** Show a function: focus a panel already showing it, else split the focused panel. */
  open: (fn: string, args?: string[]) => void;
  find: (token: string) => TermSeries | null;
  strategy: (token: string) => StrategyRun | null;
  spec: Spec; setSpec: (f: Spec | ((s: Spec) => Spec)) => void;
  basket: string[]; setBasket: (b: string[]) => void;
  win: string; setWin: (w: string) => void;
}

export const TermContext = createContext<TermCtx | null>(null);
export function useTerm(): TermCtx {
  const c = useContext(TermContext);
  if (!c) throw new Error("useTerm outside the terminal");
  return c;
}

export interface PanelCtx {
  leaf: Leaf;
  setOpt: (key: string, value: string) => void;
  setArgs: (args: string[]) => void;
  setAsOf: (d: string | null) => void;
  setTitle: (t: string | null) => void;
  focused: boolean;
}
export const PanelContext = createContext<PanelCtx | null>(null);
export function usePanel(): PanelCtx {
  const c = useContext(PanelContext);
  if (!c) throw new Error("usePanel outside a panel");
  return c;
}

/** A panel option kept in the saved workspace (a filter, a range). */
export function useOpt(key: string, fallback: string): [string, (v: string) => void] {
  const p = usePanel();
  return [p.leaf.opts?.[key] ?? fallback, (v) => p.setOpt(key, v)];
}

/** Load something shared once and follow its state. */
export function useLoad<T>(get: () => Promise<Loadable<T>>): Loadable<T> {
  const [v, setV] = useState<Loadable<T>>({ status: "loading" });
  useEffect(() => {
    let live = true;
    get().then((r) => { if (live) setV(r); });
    return () => { live = false; };
  }, [get]);
  return v;
}

/** Set the panel header's title (a series name, a pair). */
export function usePanelTitle(t: string | null | undefined) {
  const { setTitle } = usePanel();
  useEffect(() => { setTitle(t ?? null); }, [t]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Report the "as of" date shown in the panel header. */
export function useAsOf(d: string | null | undefined) {
  const { setAsOf } = usePanel();
  useEffect(() => { setAsOf(d ?? null); }, [d]); // eslint-disable-line react-hooks/exhaustive-deps
}
