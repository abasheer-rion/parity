// Building blocks shared by the sign-in pages: the centred card, labelled fields with the
// right autocomplete hints for password managers, and a small async-submit helper.
import { useState, type FormEvent, type ReactNode } from "react";
import "./auth.css";

export function AuthCard({ title, lead, children, foot }: { title: string; lead?: ReactNode; children: ReactNode; foot?: ReactNode }) {
  return (
    <div className="auth-page">
      <div className="auth-card anim-rise">
        <a className="auth-brand" href="#/" aria-label="Parity">
          <img src="/brand/2026-10-21/parity-icon-dark.svg" width={32} height={32} alt="" />
          <span>Parity</span>
        </a>
        <h1 className="auth-title">{title}</h1>
        {lead && <p className="auth-lead">{lead}</p>}
        {children}
      </div>
      {foot && <div className="auth-foot">{foot}</div>}
    </div>
  );
}

type Auto = "email" | "current-password" | "new-password" | "one-time-code" | "off";

export function Field({ label, value, onChange, type = "text", auto, hint, autoFocus, minLength, name }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; auto?: Auto;
  hint?: ReactNode; autoFocus?: boolean; minLength?: number; name?: string;
}) {
  const code = auto === "one-time-code";
  return (
    <label className="ui-field auth-field">
      <span className="ui-field-label">{label}</span>
      <input
        className={`ui-input ${code ? "auth-code-input" : ""}`}
        name={name ?? auto}
        type={type}
        value={value}
        required
        autoFocus={autoFocus}
        autoComplete={auto}
        minLength={minLength}
        inputMode={code ? "numeric" : type === "email" ? "email" : undefined}
        pattern={code ? "[0-9]{6,10}" : undefined}
        maxLength={code ? 10 : undefined}
        spellCheck={false}
        autoCapitalize="none"
        onChange={(e) => onChange(code ? e.target.value.replace(/\D/g, "") : e.target.value)}
      />
      {hint && <span className="auth-hint">{hint}</span>}
    </label>
  );
}

export function Notice({ tone = "bad", children }: { tone?: "bad" | "good" | "info"; children: ReactNode }) {
  if (!children) return null;
  return <div className={`auth-notice auth-notice-${tone}`} role={tone === "bad" ? "alert" : "status"}>{children}</div>;
}

/** Runs an async submit, tracking busy and the error message to show. */
export function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<string | null | void>) => async (e?: FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const msg = await fn();
      if (msg) setError(msg);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}

/** The query string inside the hash route, e.g. #/auth/verify?type=email&token_hash=... */
export function hashParams(): URLSearchParams {
  const q = window.location.hash.split("?")[1] ?? "";
  return new URLSearchParams(q);
}

export function go(hash: string) {
  window.location.hash = hash;
}
