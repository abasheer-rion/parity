import type { ReactNode } from "react";

export function StatTile({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "good" | "bad";
}) {
  return (
    <div className="tile">
      <div className="tile-label">{label}</div>
      <div className="tile-value">{value}</div>
      {note && (
        <div className={`tile-note ${tone ?? ""}`}>
          {tone === "good" ? "Above " : tone === "bad" ? "Below " : ""}
          {note}
        </div>
      )}
    </div>
  );
}

export function Card({ title, help, children }: { title: string; help?: ReactNode; children: ReactNode }) {
  return (
    <section className="card">
      <header>
        <h2>{title}</h2>
        {help && <p className="help">{help}</p>}
      </header>
      {children}
    </section>
  );
}

export function Pass({ ok, label }: { ok: boolean | null; label: string }) {
  const text = ok == null ? "Not tested" : ok ? "Pass" : "Fail";
  return (
    <span className={`pass ${ok == null ? "na" : ok ? "yes" : "no"}`} title={label}>
      <span aria-hidden>{ok == null ? "?" : ok ? "✓" : "✕"}</span> {text}
    </span>
  );
}
