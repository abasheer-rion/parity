// Parity Workbench settings (DEC-0043): density, which view opens first, the browser-only
// drafts, the keys and the legal links. Kept in this browser.
import { useState, type ReactNode } from "react";
import { LEGAL_PAGES } from "../legal/LegalLinks";
import { readSaved, writeSaved } from "../lib/scenarios";
import { productUrl, researchUrl } from "../lib/space";
import { Button, MotionControl, Segmented, toast, useMotionHelp } from "../ui";
import { EDGE_DRAFT } from "./EdgesView";
import { KeyTable } from "./KeyTable";
import type { Settings } from "./state";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return <div className="lb-set-row"><span>{label}</span><span className="lb-set-ctl">{children}</span></div>;
}

export function SettingsView({ settings, set }: { settings: Settings; set: (p: Partial<Settings>) => void }) {
  const [saved, setSaved] = useState(() => readSaved().length);
  const motionHelp = useMotionHelp();
  return (
    <div className="lb-view lb-scroll">
      <div className="lb-settings">
        <section className="lb-box" aria-labelledby="ls-view">
          <h2 id="ls-view" className="lb-sub">View</h2>
          <Row label="Density"><Segmented size="sm" label="Density" value={settings.density} onChange={(density) => set({ density })} options={[["compact", "Compact"], ["comfortable", "Comfortable"]]} /></Row>
          <Row label="Open on"><Segmented size="sm" label="Open on" value={settings.start} onChange={(start) => set({ start })} options={[["last", "The last view"], ["try", "Try settings"]]} /></Row>
          <Row label="Motion"><MotionControl /></Row>
          <p className="lb-dim lb-pad0">{motionHelp}</p>
        </section>
        <section className="lb-box" aria-labelledby="ls-data">
          <h2 id="ls-data" className="lb-sub">Kept in this browser</h2>
          <Row label={`Saved scenarios: ${saved}`}>
            <Button size="sm" variant="tertiary" disabled={!saved} onClick={() => { writeSaved([]); setSaved(0); toast("Saved scenarios cleared"); }}>Clear</Button>
          </Row>
          <Row label="Edge Lab checklist draft">
            <Button size="sm" variant="tertiary" onClick={() => { try { localStorage.removeItem(EDGE_DRAFT); } catch { /* blocked */ } toast("Draft cleared"); }}>Clear</Button>
          </Row>
          <p className="lb-dim lb-pad0">Nothing done in the Workbench is sent to the research side. The search and Edge Lab are shown read only.</p>
        </section>
        <section className="lb-box" aria-labelledby="ls-keys">
          <h2 id="ls-keys" className="lb-sub">Keys</h2>
          <KeyTable />
        </section>
        <section className="lb-box" aria-labelledby="ls-links">
          <h2 id="ls-links" className="lb-sub">Links</h2>
          <nav className="lb-links" aria-label="Links">
            <a href={productUrl("#/strategies")} target="_blank" rel="noopener">All strategies</a>
            <a href={researchUrl("#/ledger")} target="_blank" rel="noopener">Official record</a>
            <a href={productUrl("#/learn")} target="_blank" rel="noopener">Glossary</a>
            {LEGAL_PAGES.map((p) => <a key={p.href} href={p.href} target="_blank" rel="noopener">{p.label}</a>)}
          </nav>
        </section>
      </div>
    </div>
  );
}
