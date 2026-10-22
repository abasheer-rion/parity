// Building blocks shared by the sign-in pages: the centred card, labelled fields with the
// right autocomplete hints for password managers, a password field with show and hide,
// messages that screen readers announce, and a small async-submit helper.
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { SkipLink } from "../components/SkipLink";
import { LegalLinks } from "../legal/LegalLinks";
import { passwordRules } from "./rules";
import "./auth.css";

export function AuthCard({ title, lead, children, foot }: { title: string; lead?: ReactNode; children: ReactNode; foot?: ReactNode }) {
  return (
    <div className="auth-page">
      <SkipLink />
      <main className="auth-card anim-rise" id="main" aria-labelledby="auth-title">
        <a className="auth-brand" href="/">
          <img src="/brand/2026-10-22-wordmark/parity-lockup-on-dark.svg" height={44} alt="Parity home" />
        </a>
        <h1 className="auth-title" id="auth-title">{title}</h1>
        {lead && <p className="auth-lead">{lead}</p>}
        {children}
      </main>
      <footer className="auth-foot">
        {foot && <div>{foot}</div>}
        <LegalLinks />
        <p className="auth-disclaimer">Research and education only. Not investment advice.</p>
      </footer>
    </div>
  );
}

type Auto = "email" | "username webauthn" | "current-password" | "new-password" | "one-time-code" | "off";

interface FieldProps {
  label: string; value: string; onChange: (v: string) => void; type?: string; auto?: Auto;
  hint?: ReactNode; autoFocus?: boolean; minLength?: number; maxLength?: number; name?: string;
  /** Shown under the field and announced; also marks the field invalid. */
  error?: string | null;
}

export function Field({ label, value, onChange, type = "text", auto, hint, autoFocus, minLength, maxLength, name, error }: FieldProps) {
  const id = useId();
  const code = auto === "one-time-code";
  const described = [hint ? `${id}-hint` : "", error ? `${id}-err` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className="ui-field auth-field">
      <label className="ui-field-label" htmlFor={id}>{label}</label>
      <input
        id={id}
        className={`ui-input ${code ? "auth-code-input" : ""}`}
        name={name ?? (auto === "username webauthn" ? "email" : auto)}
        type={type}
        value={value}
        required
        autoFocus={autoFocus}
        autoComplete={auto}
        minLength={minLength}
        inputMode={code ? "numeric" : type === "email" ? "email" : undefined}
        pattern={code ? "[0-9]{6,10}" : undefined}
        maxLength={code ? 10 : maxLength}
        spellCheck={false}
        autoCapitalize="none"
        aria-invalid={error ? true : undefined}
        aria-describedby={described}
        onChange={(e) => onChange(code ? e.target.value.replace(/\D/g, "") : e.target.value)}
      />
      {hint && <span className="auth-hint" id={`${id}-hint`}>{hint}</span>}
      {error && <span className="auth-field-error" id={`${id}-err`}>{error}</span>}
    </div>
  );
}

/**
 * A password field with a Show / Hide button. With `rules`, a checklist under it ticks
 * off each rule as the person types (for new passwords).
 */
export function PasswordField({ label, value, onChange, auto, autoFocus, name, rules, error }: {
  label: string; value: string; onChange: (v: string) => void; auto: "current-password" | "new-password";
  autoFocus?: boolean; name?: string; rules?: boolean; error?: string | null;
}) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const list = rules ? passwordRules(value).filter((r) => r.id !== "max" || !r.ok) : [];
  const described = [rules ? `${id}-rules` : "", error ? `${id}-err` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className="ui-field auth-field">
      <label className="ui-field-label" htmlFor={id}>{label}</label>
      <div className="auth-pw">
        <input
          id={id}
          className="ui-input"
          name={name ?? (auto === "new-password" ? "new-password" : "password")}
          type={shown ? "text" : "password"}
          value={value}
          required
          autoFocus={autoFocus}
          autoComplete={auto}
          spellCheck={false}
          autoCapitalize="none"
          aria-invalid={error ? true : undefined}
          aria-describedby={described}
          onChange={(e) => onChange(e.target.value)}
        />
        <button type="button" className="auth-pw-toggle" aria-controls={id} aria-pressed={shown}
          aria-label={shown ? "Hide password" : "Show password"} onClick={() => setShown((s) => !s)}>
          {shown ? "Hide" : "Show"}
        </button>
      </div>
      {rules && (
        <ul className="auth-rules" id={`${id}-rules`} aria-label="Password rules">
          {list.map((r) => (
            <li key={r.id} className={r.ok ? "ok" : ""}>
              <span aria-hidden="true">{r.ok ? "✓" : "•"}</span> {r.label}
              <span className="sr-only">{r.ok ? ", done" : ", not yet"}</span>
            </li>
          ))}
        </ul>
      )}
      {error && <span className="auth-field-error" id={`${id}-err`}>{error}</span>}
    </div>
  );
}

/**
 * A message box. The live region is always in the page, so screen readers announce a
 * message when it appears, not only when the page loads with it.
 */
export function Notice({ tone = "bad", children }: { tone?: "bad" | "good" | "info"; children: ReactNode }) {
  return (
    <div className="auth-live" role={tone === "bad" ? "alert" : "status"} aria-atomic="true">
      {children ? <div className={`auth-notice auth-notice-${tone}`}>{children}</div> : null}
    </div>
  );
}

/** The full-page "Loading" placeholder, announced politely. */
export function Splash({ children = "Loading" }: { children?: ReactNode }) {
  return <div className="auth-splash" role="status" aria-live="polite">{children}</div>;
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
      setError(friendlyThrown(err));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}

/** A thrown error (often a dropped connection) in plain words. */
export function friendlyThrown(err: unknown): string {
  if (err instanceof TypeError || (err instanceof Error && /fetch|network/i.test(err.message))) {
    return "We could not reach the sign-in service. Check your connection and try again.";
  }
  return err instanceof Error && err.message ? err.message : "Something went wrong. Try again.";
}

/** The page's query string, e.g. /verify/?type=email&token_hash=... */
export function params(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}

export { go } from "./nav";
