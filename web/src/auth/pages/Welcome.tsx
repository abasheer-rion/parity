// The short welcome after a new account is confirmed (DEC-0044): what Parity does, what
// the person wants to do first, then a choice of Verify or Parity Trade. Every step can be
// skipped, which goes where they were going (next). The picks stay in this browser and
// only change which choice comes first.
import { useState, type MouseEvent } from "react";
import { tradeUrl } from "../../lib/space";
import { DEFAULT_NEXT } from "../redirect";
import { Submit, TextButton } from "../fields";
import { Screen, plainClick, useFlow } from "../flow";
import { go } from "../nav";

type Step = "about" | "pick" | "start";
const STEPS: Step[] = ["about", "pick", "start"];

export const INTERESTS = [
  { id: "verify", label: "Check a trade log or a bot" },
  { id: "trade", label: "Practise on a demo account" },
  { id: "strategies", label: "Browse tested strategies" },
  { id: "learn", label: "Learn the basics" },
  { id: "research", label: "Read the research" },
] as const;
type Interest = (typeof INTERESTS)[number]["id"];

export const INTERESTS_KEY = "parity.interests.v1";

function savePicks(picks: Interest[]) {
  try { localStorage.setItem(INTERESTS_KEY, JSON.stringify(picks)); } catch { /* private window: nothing kept */ }
}

export function Welcome() {
  const { next } = useFlow();
  const [step, setStep] = useState<Step>("about");
  const [picks, setPicks] = useState<Interest[]>([]);
  const toggle = (id: Interest) => setPicks((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const skip = () => { savePicks(picks); go(next); };
  const n = STEPS.indexOf(step) + 1;
  const progress = (
    <div className="pa-steps" role="img" aria-label={`Step ${n} of ${STEPS.length}`}>
      {STEPS.map((s, i) => <span key={s} className={i < n ? "on" : ""} />)}
    </div>
  );
  const skipLink = <div className="pa-alt"><TextButton onClick={skip}>Skip for now</TextButton></div>;

  if (step === "about") {
    return (
      <Screen id="welcome-about" title="Welcome to Parity" lead="Your account is ready.">
        {progress}
        <div className="pa-form">
          <p className="pa-copy">Parity checks trading strategies and bots. Upload a trade log, describe a bot or pick a strategy. Parity runs five checks and says whether the record holds up, counting every setting that was tried to get it.</p>
          <Submit type="button" onClick={() => setStep("pick")} autoFocus>Continue</Submit>
        </div>
        {skipLink}
      </Screen>
    );
  }

  if (step === "pick") {
    return (
      <Screen id="welcome-pick" title="What do you want to do first?" lead="Pick any. This only changes what we suggest next.">
        {progress}
        <div className="pa-form">
          <div className="pa-chips" role="group" aria-label="What you want to do">
            {INTERESTS.map((it, i) => (
              <button key={it.id} type="button" className="pa-chip" aria-pressed={picks.includes(it.id)} onClick={() => toggle(it.id)} autoFocus={i === 0}>
                <svg className="pa-chip-tick" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3.5 7.4l2.4 2.4 4.6-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                {it.label}
              </button>
            ))}
          </div>
          <Submit type="button" onClick={() => { savePicks(picks); setStep("start"); }}>Continue</Submit>
        </div>
        {skipLink}
      </Screen>
    );
  }

  const verify = { id: "verify", href: "/app/#/verify", title: "Verify", text: "Upload a trade log, describe a bot or pick a strategy, and get the five checks." };
  const trade = { id: "trade", href: tradeUrl(), title: "Parity Trade", text: "Charts, orders and a watchlist on a demo account with delayed data." };
  const choices = picks.includes("trade") && !picks.includes("verify") ? [trade, verify] : [verify, trade];
  const open = (href: string) => (e: MouseEvent) => { if (!plainClick(e)) return; e.preventDefault(); go(href); };
  return (
    <Screen id="welcome-start" title="Where to start" lead="Open one now. Both are in the menu later.">
      {progress}
      <div className="pa-form">
        {choices.map((c, i) => (
          <a key={c.id} className={`pa-choice${i === 0 ? " first" : ""}`} href={c.href} onClick={open(c.href)}>
            <span className="pa-choice-title">{c.title}</span>
            <span className="pa-choice-text">{c.text}</span>
            <svg className="pa-choice-arr" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5L10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </a>
        ))}
      </div>
      <div className="pa-alt"><TextButton onClick={skip}>{next === DEFAULT_NEXT ? "Go to the app" : "Continue where you were"}</TextButton></div>
    </Screen>
  );
}
