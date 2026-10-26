// The bar and checklist under a new-password field: four segments that fill and change
// colour as the password gets stronger, a word for the strength (so it is never colour
// alone), and the rules ticking off one by one. Screen readers hear the strength when it
// changes. Used by the sign-in panel (fields.tsx) and Account settings (form.tsx).
import { passwordRules } from "./rules";
import { passwordStrength } from "./strength";
import "./meter.css";

export function PasswordMeter({ value, rulesId, email }: { value: string; rulesId: string; email?: string }) {
  const rules = passwordRules(value).filter((r) => r.id !== "max" || !r.ok);
  const { score, label } = passwordStrength(value, email);
  return (
    <div className="pw-meter" data-score={score}>
      <div className="pw-meter-row" aria-hidden="true">
        <div className="pw-bar">
          {[1, 2, 3, 4].map((i) => <span key={i} className={`pw-seg${score >= i ? " on" : ""}`} />)}
        </div>
        <span className="pw-word">{label}</span>
      </div>
      <span className="pw-sr" aria-live="polite" aria-atomic="true">{value ? `Password strength: ${label}` : ""}</span>
      <ul className="pw-rules" id={rulesId} aria-label="Password rules">
        {rules.map((r) => (
          <li key={r.id} className={r.ok ? "ok" : ""}>
            <span className="pw-mark" aria-hidden="true">
              <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 7.4l2.4 2.4 4.6-5" /></svg>
            </span>
            {r.label}
            <span className="pw-sr">{r.ok ? ", done" : ", not yet"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
