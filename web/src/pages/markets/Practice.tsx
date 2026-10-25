// Practice: follow a coin or an ETF with a pretend amount and watch what it would be
// worth. No real money, no orders, nothing leaves this browser. Real trading is a
// future decision for the owner (DEC-0018) and needs licensed partners first.
import { useEffect, useState } from "react";
import { Button } from "../../ui";
import { Term } from "../Learn";
import { addPractice, day, loadCrypto, pctText, positionValue, removePractice, updatePractice, usd, useMarket, usePractice, type Practice as Position } from "../../lib/markets";
import { Attribution, Banner } from "./shared";
import { localDay } from "../../lib/format";

function addFromHash(): string {
  const q = window.location.hash.split("?")[1] ?? "";
  return new URLSearchParams(q).get("add") ?? "";
}

export function Practice() {
  const list = usePractice();
  const [crypto] = useMarket(loadCrypto);
  const coins = crypto?.coins ?? [];
  const [kind, setKind] = useState<"coin" | "etf">(addFromHash() ? "etf" : "coin");
  const [coinId, setCoinId] = useState("bitcoin");
  const [ticker, setTicker] = useState(addFromHash());
  const [etfPrice, setEtfPrice] = useState("");
  const [amount, setAmount] = useState("1000");
  useEffect(() => { const t = addFromHash(); if (t) { setKind("etf"); setTicker(t); } }, []);

  const priceOf = (p: Position) => p.kind === "coin" ? coins.find((c) => c.id === p.coinId)?.price_usd ?? null : p.manualPrice ?? null;
  const total = list.reduce((acc, p) => {
    const v = positionValue(p, priceOf(p));
    return v ? { cost: acc.cost + p.amount, value: acc.value + v.value } : acc;
  }, { cost: 0, value: 0 });

  const add = () => {
    const amt = Number(amount);
    if (!(amt > 0)) return;
    const today = localDay();
    if (kind === "coin") {
      const c = coins.find((x) => x.id === coinId);
      if (!c?.price_usd) return;
      addPractice({ kind: "coin", symbol: c.symbol, name: c.name, coinId: c.id, amount: amt, entryPrice: c.price_usd, entryDate: today });
    } else {
      const px = Number(etfPrice.replace(/[$,\s]/g, ""));
      const t = ticker.trim().toUpperCase();
      if (!t || !(px > 0)) return;
      addPractice({ kind: "etf", symbol: t, name: t, amount: amt, entryPrice: px, entryDate: today, manualPrice: px });
      setEtfPrice("");
    }
  };

  return (
    <>
      <Banner icon="eyeOff">
        <strong>Practice only. No real money.</strong> These are pretend positions kept in this browser. Parity does not place orders, hold money or give advice to anyone. Clearing your browser data removes them.
        {" "}Want real order types, fees and a record kept in your account? Try the <a href="#/trade/demo">demo account</a> in Trade.
      </Banner>

      <section className="mk-card">
        <h2>Follow something <span className="mk-practice-badge">Practice</span></h2>
        <div className="mk-form">
          <label>What
            <select value={kind} onChange={(e) => setKind(e.target.value as "coin" | "etf")}>
              <option value="coin">A coin</option>
              <option value="etf">An ETF</option>
            </select>
          </label>
          {kind === "coin" ? (
            <label>Coin
              <select value={coinId} onChange={(e) => setCoinId(e.target.value)}>
                {coins.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.symbol})</option>)}
              </select>
            </label>
          ) : (
            <>
              <label>Ticker<input value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="SPY" /></label>
              <label>Today's price, from your broker<input inputMode="decimal" value={etfPrice} onChange={(e) => setEtfPrice(e.target.value)} placeholder="e.g. 512.40" /></label>
            </>
          )}
          <label>Pretend amount in dollars<input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
          <Button variant="primary" onClick={add}>Add practice position</Button>
        </div>
        {kind === "etf" && <p className="muted small">We do not have a licensed ETF price feed yet, so you type the price, and update it later to see the change.</p>}
      </section>

      <section className="mk-card" style={{ marginTop: 14 }}>
        <div className="mk-card-head">
          <h2>Your practice positions</h2>
          {total.cost > 0 && <span className="mk-num">{usd(total.value)} <span className="muted small">from {usd(total.cost)}, {pctText((total.value / total.cost - 1) * 100)}</span></span>}
        </div>
        {list.length === 0 ? <p className="muted small">Nothing yet. Add one above, or use the Practice button on the Crypto or ETFs page.</p> : (
          <ul className="mk-list">
            {list.map((p) => {
              const px = priceOf(p);
              const v = positionValue(p, px);
              return (
                <li key={p.id}>
                  <div className="mk-pos">
                    <span className="mk-name"><span className="mk-sym">{p.symbol}</span> {p.name !== p.symbol ? p.name : ""}<br /><span className="muted small">{usd(p.amount)} at {usd(p.entryPrice)} on {day(p.entryDate)}</span></span>
                    <span className="mk-num">{p.kind === "etf" ? (
                      <input aria-label={`Latest price of ${p.symbol}`} inputMode="decimal" defaultValue={p.manualPrice ?? ""} onBlur={(e) => { const n = Number(e.target.value.replace(/[$,\s]/g, "")); if (n > 0) updatePractice(p.id, { manualPrice: n }); }} />
                    ) : usd(px)}</span>
                    <span className="mk-num">{v ? usd(v.value) : "n/a"}</span>
                    <span className="mk-num">{v ? `${pctText(v.changePct)} (${v.change >= 0 ? "+" : "−"}${usd(Math.abs(v.change))})` : ""}</span>
                    <Button size="sm" variant="tertiary" onClick={() => removePractice(p.id)}>Remove</Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="muted small">Values ignore fees, spreads and taxes, which a real trade would pay. Coin prices come from the Crypto page and update when it does. A good run in practice is not evidence of skill; see <Term id="outcome-bias">outcome bias</Term>.</p>
        {crypto && <Attribution sources={crypto.sources} />}
      </section>

      <section className="mk-card" style={{ marginTop: 14 }}>
        <h2>Free to trade, later</h2>
        <p className="small">We want Parity to be free to research now and, one day, free to trade. Real trading needs a licensed broker partner, identity checks and crypto licences first, and Parity must not give anyone personal advice. Until that work is done and the owner decides, practice is all there is. The plan is in the research docs (DEC-0018).</p>
      </section>
    </>
  );
}
