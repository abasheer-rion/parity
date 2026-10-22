// Perps: what a perpetual future is, funding as a cost of holding, open interest, and
// how leverage turns a small move into a total loss. Ordered by open interest (size).
import { useMemo, useState } from "react";
import { DataTable, LineChart, Select, type Column } from "../../ui";
import { Term } from "../Learn";
import { day, loadPerps, pctText, usd, usdCompact, useMarket, type Perp } from "../../lib/markets";
import { Attribution, Banner, Loading, Risk, Sources, Stat } from "./shared";

/** Price move against you that leaves only the maintenance margin, in percent. On
 *  Hyperliquid maintenance margin is half the initial margin at the coin's maximum
 *  leverage. Rough: ignores fees, funding and slippage. */
export function liquidationMove(leverage: number, maxLeverage: number): number {
  return Math.max(0, 100 / leverage - 100 / (2 * maxLeverage));
}

export function Perps() {
  const [doc, error] = useMarket(loadPerps);
  const perps = doc?.perps ?? [];
  const withHistory = useMemo(() => perps.filter((p) => p.funding_daily.length > 0), [perps]);
  const [coin, setCoin] = useState("BTC");
  const [amount, setAmount] = useState(1000);
  const [days, setDays] = useState(30);
  const [lev, setLev] = useState(10);
  if (!doc) return <Loading error={error} what="perpetual futures" />;
  if (doc.withheld || !perps.length) {
    return <Banner><strong>Perpetual futures data is switched off for now.</strong> We are checking whether the source's terms let us show it. The explanations below still apply.</Banner>;
  }
  const p = perps.find((x) => x.coin === coin) ?? perps[0];
  const maxLev = p.max_leverage ?? 1;
  const useLev = Math.min(lev, maxLev);
  const rate = p.funding?.avg_7d_annual_pct ?? p.funding_annual_pct ?? 0;
  const cost = amount * (rate / 100) * (days / 365);
  const move = liquidationMove(useLev, maxLev);

  const cols: Column<Perp>[] = [
    { key: "coin", header: "Perp", sort: (r) => r.coin, align: "left", render: (r) => <span className="mk-name">{r.coin}</span> },
    { key: "px", header: "Price", sort: (r) => r.mark_px, render: (r) => <span className="mk-num">{usd(r.mark_px)}</span> },
    { key: "d1", header: "1 day", sort: (r) => r.change_24h_pct, render: (r) => <span className="mk-num">{pctText(r.change_24h_pct)}</span> },
    { key: "f", header: "Funding now, a year", sort: (r) => r.funding_annual_pct, render: (r) => <span className="mk-num">{pctText(r.funding_annual_pct)}</span> },
    { key: "f7", header: "7-day average", sort: (r) => r.funding?.avg_7d_annual_pct, render: (r) => <span className="mk-num">{pctText(r.funding?.avg_7d_annual_pct)}</span> },
    { key: "oi", header: "Open interest", sort: (r) => r.open_interest_usd, render: (r) => <span className="mk-num">{usdCompact(r.open_interest_usd)}</span> },
    { key: "vol", header: "Traded, 1 day", sort: (r) => r.day_volume_usd, render: (r) => <span className="mk-num">{usdCompact(r.day_volume_usd)}</span> },
    { key: "lev", header: "Max leverage", sort: (r) => r.max_leverage, render: (r) => <span className="mk-num">{r.max_leverage}x</span> },
    { key: "liq", header: "Wiped out by", sort: (r) => r.liquidation_move_at_max_pct, render: (r) => <span className="mk-num" title="Price move against you that liquidates a position opened at maximum leverage">{pctText(r.liquidation_move_at_max_pct, 2, false)}</span> },
  ];

  return (
    <>
      <div className="mk-grid">
        <section className="mk-card">
          <h2>What a perp is</h2>
          <p className="small">A <Term id="perpetual-future">perpetual future</Term> is a bet on a coin's price that never expires. You never own the coin. To keep the bet's price close to the real price, the side with more demand pays the other side a small fee every hour, the <Term id="funding-rate">funding rate</Term>.</p>
          <p className="small">Most people trade perps with borrowed money, called <Term id="leverage">leverage</Term>. That is where most of the danger is.</p>
        </section>
        <section className="mk-card">
          <h2>Funding is a cost of holding</h2>
          <p className="small">When funding is positive, people betting on a rise pay people betting on a fall. We show it as a yearly rate so you can compare it with a loan. On Hyperliquid, a quiet market sits near 10.95% a year, the built-in interest part. Rates far above that mean many people are crowded on one side.</p>
          <p className="small"><Term id="open-interest">Open interest</Term> is the value of all bets still open. It is a measure of size, not of whether a price will rise.</p>
        </section>
      </div>

      <Risk>
        With 20 times leverage, a move of less than 5% against you wipes out your deposit. The exchange closes the position for you, called <Term id="liquidation">liquidation</Term>, and prices can jump straight past your stop. Funding can also turn against you every hour. Where brokers must publish it, as in the EU, most retail accounts trading leveraged products lose money.
      </Risk>

      <section className="mk-card">
        <div className="mk-card-head">
          <h2>Try the numbers: {p.coin}</h2>
          <Select label="Perp" value={p.coin} onChange={setCoin} options={perps.slice(0, 40).map((x) => [x.coin, x.coin] as [string, string])} />
        </div>
        <div className="mk-form">
          <label>Bet size in dollars<input type="number" min={10} step={100} value={amount} onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))} /></label>
          <label>Days held<input type="number" min={1} max={365} value={days} onChange={(e) => setDays(Math.min(365, Math.max(1, Number(e.target.value) || 1)))} /></label>
          <label>Leverage, up to {maxLev}x<input type="range" min={1} max={maxLev} value={useLev} onChange={(e) => setLev(Number(e.target.value))} aria-valuetext={`${useLev} times`} /></label>
          <label>Deposit needed<input readOnly value={usd(amount / useLev)} aria-label="Deposit needed" /></label>
        </div>
        <div className="mk-stats">
          <Stat label="Funding cost if held" value={usd(cost)} note={`at the 7-day average of ${pctText(rate)} a year, for a bet on a rise. A bet on a fall would receive about this.`} />
          <Stat label="Leverage" value={`${useLev}x`} note={`${usd(amount)} bet on ${usd(amount / useLev)} of your money`} />
          <Stat label="Liquidated after a move of" term="liquidation" value={pctText(move, 2, false)} note="against you, roughly, before fees and funding" />
          <Stat label="Loss at liquidation" value={usd(amount / useLev)} note="about your whole deposit" />
        </div>
        {p.funding && p.funding_daily.length > 0 && (
          <>
            <div className="mk-chart">
              <LineChart series={[{ name: `${p.coin} funding`, color: "var(--series-2)", points: p.funding_daily }]} height={180} format={(v) => pctText(v)} label={`${p.coin} daily average funding, as a yearly rate`} />
            </div>
            <p className="muted small">Daily average funding as a yearly rate over the last {Math.round(p.funding.hours / 24)} days. Longs paid in {Math.round((p.funding.positive_share_30d ?? 0) * 100)}% of hours. The hourly rate ranged from {pctText(p.funding.min_hour_annual_pct)} to {pctText(p.funding.max_hour_annual_pct)} a year. Past funding does not set future funding.</p>
          </>
        )}
        {!p.funding && withHistory.length > 0 && <p className="muted small">Funding history is kept for {withHistory.map((x) => x.coin).join(", ")}.</p>}
        <Attribution sources={doc.sources} />
      </section>

      <section style={{ marginTop: 16 }}>
        <div className="mk-card-head"><h2 style={{ margin: 0, fontSize: 16 }}>Every perp on {doc.venue}</h2><span className="muted small">largest open interest first, {day(doc.fetched_at)}</span></div>
        <p className="muted small">"Wiped out by" is the price move that liquidates a position opened at the maximum leverage the exchange allows.</p>
        <div className="mk-table-scroll">
          <DataTable rows={perps} columns={cols} rowKey={(r) => r.coin} initialSort={{ key: "oi", dir: "desc" }} dense caption={`Perpetual futures on ${doc.venue}`} />
        </div>
        <Attribution sources={doc.sources} />
      </section>
      <Sources sources={doc.sources} />
    </>
  );
}
