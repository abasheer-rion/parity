// "Paste strategy code" on the Verify page (DEC-0083): Pine Script or Python is read into
// Parity's rule format in this browser and run on our daily prices; a description in words is
// turned into rules by the person's own AI model (their key, from this browser) or by any AI
// chat they paste our prompt into. The code is never sent to Parity. Running needs our daily
// price file, which loads for signed-in accounts only.
import { useContext, useMemo, useState } from "react";
import { complete, ProviderError } from "../../assistant/chat";
import { PROVIDERS, providerById, readKey, readModel, readProvider, writeKey, writeProvider, type ProviderId } from "../../assistant/keys";
import { startUrl } from "../../assistant/openrouter";
import { benchmarkFrom, checkBacktest, type Result } from "../../lib/verify/checks";
import { loadPrices } from "../../lib/verify/prices";
import {
  exprText, finishRead, MARKETS, plainPrompt, readPlainReply, readStrategy, runStrategy, RulesError, ScriptError,
  type Language, type Rules, type ScriptRead, type Unsupported,
} from "../../lib/verify/strategy";
import { PINE_EXAMPLE, PYTHON_EXAMPLE, WORDS_EXAMPLE } from "../../lib/verify/strategy/examples";
import { Button, ChoiceCards, Disclosure, Input, Select, TextButton, type Choice } from "../../ui";
import { SignedIn } from "./signedIn";

type Have = "code" | "words";
const HAVE: Choice<Have>[] = [
  { value: "code", title: "Code", body: "Pine Script from TradingView, a Python strategy, or rules in our format." },
  { value: "words", title: "A description in words", body: "Your own AI model writes the rules. You check them before anything runs." },
];
const LANGS: [Language | "auto", string][] = [["auto", "Find it from the code"], ["pine", "Pine Script"], ["python", "Python"], ["rules", "Rules in our format (JSON)"]];

function UnsupportedList({ items, title }: { items: Unsupported[]; title: string }) {
  return (
    <div className="vf-cannot" role="alert">
      <p><strong>{title}</strong></p>
      <ul>
        {items.map((u) => <li key={`${u.what}-${u.line}`}>{u.line ? <span className="vf-line">Line {u.line}</span> : null}<code>{u.what}</code>: {u.why}</li>)}
      </ul>
    </div>
  );
}

/** The rules in words, one line each, so the person can see what will be tested. */
export function RulesSummary({ rules }: { rules: Rules }) {
  const lines: string[] = [];
  const inputs = Object.entries(rules.inputs);
  if (inputs.length) lines.push(`Settings: ${inputs.map(([k, v]) => `${k} = ${v}`).join(", ")}.`);
  for (const [k, v] of Object.entries(rules.let)) lines.push(`${k} is ${exprText(v)}.`);
  for (const side of ["long", "short"] as const) {
    const s = rules[side];
    if (!s) continue;
    const word = side === "long" ? "Buy" : "Sell short";
    if (s.entry != null) lines.push(`${word} when ${exprText(s.entry)}.`);
    if (s.exit != null) lines.push(`Close the ${side} position when ${exprText(s.exit)}.`);
    if (s.stop != null) lines.push(`${side === "long" ? "Long" : "Short"} stop at ${exprText(s.stop)}.`);
    if (s.limit != null) lines.push(`${side === "long" ? "Long" : "Short"} target at ${exprText(s.limit)}.`);
    if (s.stop_loss) lines.push(`Stop ${(s.stop_loss * 100).toFixed(1)}% from the entry price.`);
    if (s.take_profit) lines.push(`Take profit ${(s.take_profit * 100).toFixed(1)}% from the entry price.`);
  }
  if (rules.size != null && rules.size !== 1) lines.push(`Each position uses ${(rules.size * 100).toFixed(0)}% of the account.`);
  return <ul className="vf-rules">{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>;
}

export function CodeInput({ onResult }: { onResult: (r: Result) => void }) {
  const signedIn = useContext(SignedIn);
  const [have, setHave] = useState<Have>("code");
  const [code, setCode] = useState("");
  const [words, setWords] = useState("");
  const [lang, setLang] = useState<Language | "auto">("auto");
  const [market, setMarket] = useState("BTCUSD");
  const [tries, setTries] = useState("1");
  const [read, setRead] = useState<ScriptRead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The person's own model, for words.
  const [provider, setProvider] = useState<ProviderId>(readProvider);
  const [key, setKey] = useState<string | null>(() => readKey(readProvider()));
  const [draftKey, setDraftKey] = useState("");
  const info = providerById(provider);
  const prompt = useMemo(() => plainPrompt(words.trim() || WORDS_EXAMPLE, market), [words, market]);
  const triesN = Math.min(10_000_000, Math.max(1, Math.floor(Number(tries) || 1)));

  const reset = () => { setRead(null); setError(null); };

  const readCode = (): ScriptRead | null => {
    setError(null);
    try {
      const r = readStrategy({ code, language: lang, market });
      setRead(r);
      return r;
    } catch (e) {
      setRead(null);
      if (e instanceof ScriptError || e instanceof RulesError) { setError(e instanceof RulesError && e.problems.length > 1 ? e.problems.join(" ") : e.message); return null; }
      throw e;
    }
  };

  const fromWords = async () => {
    setError(null); setBusy(true);
    try {
      const reply = await complete({ provider, key: key!, model: readModel(provider), system: prompt.system, prompt: prompt.prompt, origin: window.location.origin });
      const r = finishRead(readPlainReply(reply, market), market);
      setRead(r);
      if (r.rules) setCode(JSON.stringify(r.rules, null, 2));
    } catch (e) {
      setError(e instanceof ProviderError ? e.message : "Your model could not be reached. Check the key and try again.");
    } finally { setBusy(false); }
  };

  const run = async () => {
    const r = have === "code" || !read ? readCode() : read;
    if (!r?.rules) return;
    if (!signedIn) return;
    setBusy(true);
    try {
      const book = await loadPrices();
      if (!book) { setError("Our daily prices could not be loaded. Try again in a moment."); return; }
      const ran = runStrategy(r as ScriptRead & { rules: Rules }, book);
      onResult(checkBacktest(ran, triesN, tries.trim() === "1" || !tries.trim(), benchmarkFrom(book)));
    } catch (e) {
      if (e instanceof RulesError) { setError(e.message); return; }
      throw e;
    } finally { setBusy(false); }
  };

  const saveKey = () => { writeKey(provider, draftKey); setKey(readKey(provider)); setDraftKey(""); };
  const choose = (p: ProviderId) => { writeProvider(p); setProvider(p); setKey(readKey(p)); };
  const loginHref = `/login/?next=${encodeURIComponent("/verify/")}`;

  return (
    <div className="vf-panel">
      <p className="vf-privacy">Your code stays in this browser. It is read and run on your device against our daily prices, and is never sent to our servers.</p>
      <ChoiceCards<Have> label="What do you have?" value={have} onChange={(h) => { setHave(h); reset(); }} options={HAVE} />

      {have === "code" ? (
        <>
          <label className="ui-field">
            <span className="ui-field-label">Paste the strategy's code</span>
            <textarea className="ui-input vf-textarea vf-code" value={code} spellCheck={false} rows={14} maxLength={60000}
              onChange={(e) => { setCode(e.target.value); reset(); }} placeholder={'//@version=5\nstrategy("My strategy")\n...'} />
          </label>
          <div className="vf-row">
            <TextButton onClick={() => { setCode(PINE_EXAMPLE); setLang("auto"); reset(); }}>Use the Pine Script example</TextButton>
            <TextButton onClick={() => { setCode(PYTHON_EXAMPLE); setLang("auto"); reset(); }}>Use the Python example</TextButton>
          </div>
        </>
      ) : (
        <>
          <label className="ui-field">
            <span className="ui-field-label">Describe the rules: when it buys, when it sells, any stop or target</span>
            <textarea className="ui-input vf-textarea" value={words} rows={4} maxLength={4000} onChange={(e) => { setWords(e.target.value); reset(); }} placeholder={WORDS_EXAMPLE} />
          </label>
          <div className="vf-model">
            {key ? (
              <p className="vf-small">Your {info.name.split(" (")[0]} key is kept in this browser only. Parity never sees it and never pays for the call. <TextButton tone="muted" onClick={() => { writeKey(provider, null); setKey(null); }}>Forget the key</TextButton></p>
            ) : (
              <div className="vf-model-connect">
                <Select<ProviderId> label="Your AI provider" value={provider} onChange={choose} options={PROVIDERS.map((p) => [p.id, p.name])} />
                {info.connect === "oauth"
                  ? <Button size="sm" onClick={async () => { window.location.href = await startUrl(window.location.origin, "/verify/"); }}>Connect OpenRouter</Button>
                  : <><Input label={`Your ${info.name.split(" (")[0]} key`} type="password" value={draftKey} onChange={setDraftKey} placeholder={info.keyHint} />
                    <Button size="sm" onClick={saveKey} disabled={draftKey.trim().length < 10}>Save in this browser</Button></>}
              </div>
            )}
            <div className="vf-row">
              <Button variant="primary" onClick={() => void fromWords()} disabled={!key || words.trim().length < 10} loading={busy && !read}>Write the rules with my model</Button>
              <TextButton onClick={() => { setWords(WORDS_EXAMPLE); reset(); }}>Use the example</TextButton>
            </div>
            <Disclosure summary="No key? Use any AI chat instead">
              <p className="vf-small">Copy this into ChatGPT, Claude, Gemini or another AI chat. Paste the JSON it answers into Code, with "Rules in our format".</p>
              <textarea className="ui-input vf-textarea vf-code" readOnly rows={8} value={`${prompt.system}\n\n${prompt.prompt}`} aria-label="The prompt for your AI chat" />
              <div className="vf-row">
                <Button size="sm" onClick={() => { void navigator.clipboard?.writeText(`${prompt.system}\n\n${prompt.prompt}`); }}>Copy the prompt</Button>
                <TextButton onClick={() => { setHave("code"); setLang("rules"); reset(); }}>Paste the answer in Code</TextButton>
              </div>
            </Disclosure>
          </div>
        </>
      )}

      <div className="vf-questions">
        <label className="ui-field"><span className="ui-field-label">Market to run it on</span>
          <Select<string> label="Market to run it on" value={market} onChange={(m) => { setMarket(m); reset(); }} options={MARKETS.map((m) => [m.id, `${m.name} (${m.id})`])} />
          <span className="vf-help">Code does not say which market it trades. We hold daily closing prices for these.</span>
        </label>
        {have === "code" && (
          <label className="ui-field"><span className="ui-field-label">Language</span>
            <Select<Language | "auto"> label="Language" value={lang} onChange={(l) => { setLang(l); reset(); }} options={LANGS} />
          </label>
        )}
        <div className="ui-field">
          <Input label="How many versions or settings did you try before this one?" type="number" value={tries} onChange={setTries} />
          <span className="vf-help">We add the nearby settings we run ourselves, because settings like these are usually found by trying settings like those.</span>
        </div>
      </div>

      {error && <p className="vf-error" role="alert">{error}</p>}
      {read && read.blocking.length > 0 && <UnsupportedList items={read.blocking} title={`We cannot run this yet. ${read.blocking.length === 1 ? "One part" : `${read.blocking.length} parts`} cannot be turned into rules on one closing price a day:`} />}
      {read?.rules && (
        <Disclosure summary="The rules we will run" defaultOpen={read.language === "plain"}>
          <RulesSummary rules={read.rules} />
          {read.notes.map((n) => <p key={n} className="vf-small">{n}</p>)}
        </Disclosure>
      )}
      {read && read.ignored.length > 0 && (
        <Disclosure summary={`Left out: ${read.ignored.length} part${read.ignored.length === 1 ? "" : "s"} that do not change the trades`}>
          <ul className="vf-left">{read.ignored.map((u) => <li key={`${u.what}-${u.line}`}>{u.line ? `Line ${u.line}: ` : ""}<code>{u.what}</code>, {u.why}</li>)}</ul>
        </Disclosure>
      )}
      {!signedIn && read?.rules && (
        <p className="vf-small">The code reads cleanly. Running it needs our daily prices, which load for signed-in accounts only. <a href={loginHref}>Log in</a> or <a href={`/signup/?next=${encodeURIComponent("/verify/")}`}>create a free account</a>, then paste it again.</p>
      )}
      <div className="vf-row">
        {have === "code"
          ? <Button variant="primary" onClick={() => void run()} disabled={code.trim().length < 10} loading={busy}>{signedIn ? "Run and check it" : "Read the code"}</Button>
          : read?.rules && <Button variant="primary" onClick={() => void run()} disabled={!signedIn} loading={busy && !!read}>Run and check these rules</Button>}
      </div>
    </div>
  );
}
