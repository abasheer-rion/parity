// Building blocks for the sign-in panel (AuthFlow.tsx, DEC-0044): fields with the right
// autocomplete hints for password managers, a password field with show and hide, the
// front page's button with a loading state, messages screen readers announce, and a
// submit helper that puts each error under the field it is about.
import { useId, useState, type FormEvent, type MouseEvent, type ReactNode } from "react";
import { PasswordMatch, passwordsMatch, PasswordMeter } from "./PasswordMeter";
import { emailProblem } from "./rules";

/** An error from a form. With `field`, it shows under that field; without, above the button. */
export interface Problem { field?: string; message: string }

/** Returned by a submit that has started leaving the page: the button keeps its spinner. */
export const LEAVING = Symbol("leaving");

type Outcome = string | Problem | typeof LEAVING | null | undefined | void;

/** Runs an async submit, tracking busy and the error to show. */
export function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const run = (fn: () => Promise<Outcome>) => async (e?: FormEvent | MouseEvent) => {
    e?.preventDefault();
    if (busy) return;
    setBusy(true);
    setProblem(null);
    let out: Outcome;
    try {
      out = await fn();
    } catch (err) {
      out = friendlyThrown(err);
    }
    if (out === LEAVING) return;
    if (out) setProblem(typeof out === "string" ? { message: out } : out);
    setBusy(false);
  };
  return {
    busy,
    problem,
    setProblem,
    run,
    /** The message for one field, if the last error was about it. */
    errorFor: (field: string) => (problem?.field === field ? problem.message : null),
    /** The message that is not about any one field. */
    general: problem && !problem.field ? problem.message : null,
  };
}

/** A thrown error (often a dropped connection) in plain words. */
export function friendlyThrown(err: unknown): string {
  if (err instanceof TypeError || (err instanceof Error && /fetch|network/i.test(err.message))) {
    return "We could not reach the sign-in service. Check your connection and try again.";
  }
  return err instanceof Error && err.message ? err.message : "Something went wrong. Try again.";
}

type Auto = "username" | "email" | "current-password" | "new-password" | "one-time-code";

interface FieldProps {
  label: string; value: string; onChange: (v: string) => void;
  type?: "text" | "email"; auto?: Auto; name?: string; autoFocus?: boolean;
  /** Small text under the field. */
  hint?: ReactNode;
  /** A link or button on the right of the label, such as "Forgot password?". */
  aside?: ReactNode;
  /** An error from the last submit: shown under the field, announced, and marks it invalid. */
  error?: string | null;
}

/** A labelled text, email or code field. Email is checked once you leave it. */
export function Field({ label, value, onChange, type = "text", auto, name, autoFocus, hint, aside, error }: FieldProps) {
  const id = useId();
  const code = auto === "one-time-code";
  const [touched, setTouched] = useState(false);
  const check = type === "email" && touched && value.trim() ? emailProblem(value) : null;
  const shown = error ?? check;
  const described = [hint ? `${id}-hint` : "", shown ? `${id}-err` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className="pa-field">
      <div className="pa-label-row">
        <label className="pa-label" htmlFor={id}>{label}</label>
        {aside}
      </div>
      <input
        id={id}
        className={`pa-input${code ? " pa-code" : ""}`}
        name={name ?? (type === "email" ? "email" : auto)}
        type={type}
        value={value}
        required
        autoFocus={autoFocus}
        autoComplete={auto}
        inputMode={code ? "numeric" : type === "email" ? "email" : undefined}
        pattern={code ? "[0-9]{6,10}" : undefined}
        maxLength={code ? 10 : 254}
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
        aria-invalid={shown ? true : undefined}
        aria-describedby={described}
        onBlur={() => setTouched(true)}
        onChange={(e) => onChange(code ? e.target.value.replace(/\D/g, "") : e.target.value)}
      />
      {hint && <span className="pa-hint" id={`${id}-hint`}>{hint}</span>}
      {shown && <span className="pa-error" id={`${id}-err`} role={error ? "alert" : undefined}>{shown}</span>}
    </div>
  );
}

/**
 * A password field with a Show / Hide button. With `rules`, a checklist under it ticks
 * off each rule as you type (for new passwords). With `match`, it is the confirm field for
 * that password and says whether the two match.
 */
export function PasswordField({ label, value, onChange, auto, name, autoFocus, rules, aside, error, email, match }: {
  label: string; value: string; onChange: (v: string) => void; auto: "current-password" | "new-password";
  name?: string; autoFocus?: boolean; rules?: boolean; email?: string; aside?: ReactNode; error?: string | null;
  match?: string;
}) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const [left, setLeft] = useState(false);
  const confirm = match !== undefined;
  const mismatch = confirm && value.length > 0 && !passwordsMatch(match, value) && (left || !match.startsWith(value));
  const described = [rules ? `${id}-rules` : "", confirm ? `${id}-match` : "", error ? `${id}-err` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className="pa-field">
      <div className="pa-label-row">
        <label className="pa-label" htmlFor={id}>{label}</label>
        {aside}
      </div>
      <div className="pa-pw">
        <input
          id={id}
          className="pa-input"
          name={name ?? (auto === "new-password" ? "new-password" : "password")}
          type={shown ? "text" : "password"}
          value={value}
          required
          autoFocus={autoFocus}
          autoComplete={auto}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          aria-invalid={error || mismatch ? true : undefined}
          aria-describedby={described}
          onBlur={() => setLeft(true)}
          onChange={(e) => onChange(e.target.value)}
        />
        <button type="button" className="pa-pw-toggle" aria-controls={id} aria-pressed={shown}
          aria-label={shown ? "Hide password" : "Show password"} onClick={() => setShown((s) => !s)}>
          {shown ? "Hide" : "Show"}
        </button>
      </div>
      {rules && <PasswordMeter value={value} rulesId={`${id}-rules`} email={email} />}
      {confirm && <PasswordMatch password={match} value={value} id={`${id}-match`} left={left} />}
      {error && <span className="pa-error" id={`${id}-err`} role="alert">{error}</span>}
    </div>
  );
}

/** The front page's button (`.btn`), full width, with a spinner while it works. */
export function Submit({ busy, children, primary = true, type = "submit", onClick, autoFocus, disabled }: {
  busy?: boolean; children: ReactNode; primary?: boolean; type?: "submit" | "button";
  onClick?: () => void; autoFocus?: boolean;
  /** Greyed out and not clickable, for example until the two passwords match. */
  disabled?: boolean;
}) {
  return (
    <button type={type} className={`btn${primary ? " primary" : ""} pa-btn`} aria-busy={busy || undefined} disabled={disabled}
      data-busy={busy || undefined} onClick={onClick} autoFocus={autoFocus}>
      {busy && <span className="pa-spin" aria-hidden="true" />}
      <span className="pa-btn-label">{children}</span>
      {/* Shown in place of the label once sign-in succeeds and the page starts to leave (nav.ts). */}
      {busy && (
        <svg className="pa-done" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path d="M4 9.4l3.3 3.3L14 5.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

/** A quiet text button, for "Use a different email" and the like. */
export function TextButton({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button type="button" className="pa-text" onClick={onClick} disabled={disabled}>{children}</button>;
}

/**
 * A message box. The live region is always in the page, so screen readers announce a
 * message when it appears, not only when the page loads with it.
 */
export function Notice({ tone = "bad", children }: { tone?: "bad" | "good" | "info"; children: ReactNode }) {
  return (
    <div className="pa-live" role={tone === "bad" ? "alert" : "status"} aria-atomic="true">
      {children ? <div className={`pa-notice pa-notice-${tone}`}>{children}</div> : null}
    </div>
  );
}

/** The address you are signing in with, and a button to change it. */
export function Who({ email, onChange }: { email: string; onChange: () => void }) {
  return (
    <div className="pa-who">
      <span className="pa-who-email" title={email}>{email}</span>
      <button type="button" className="pa-text" onClick={onChange} aria-label={`Change email, now ${email}`}>Change</button>
    </div>
  );
}

/** The page's query string, e.g. /verify/?type=email&token_hash=... */
export function params(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}
