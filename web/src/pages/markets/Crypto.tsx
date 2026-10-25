// Crypto: prices for the 100 largest coins by market value, a year of history for the
// majors, simple stats and the plain risks. Ordered by market value, never by gains.
import { useMemo, useState } from "react";
import { Button, DataTable, LineChart, Select, type Column } from "../../ui";
import { Term } from "../Learn";
import { addPractice, day, loadCrypto, pctText, usd, usdCompact, useMarket, type Coin, type CryptoDoc } from "../../lib/markets";
import { Attribution, Checks, Loading, Risk, Sources, Stat, type Check } from "./shared";
import { toast } from "../../ui";
import { localDay } from "../../lib/format";

export function coinChecks(c: Coin, doc: CryptoDoc): Check[] {
  const h = doc.history[c.id];
  const turnover = c.volume_24h_usd && c.market_cap_usd ? (c.volume_24h_usd / c.market_cap_usd) * 100 : null;
  const supply = c.max_supply && c.circulating_supply ? (c.circulating_supply / c.max_supply) * 100 : null;
  return [
    { label: "Fees", text: "Exchanges charge trading fees and a spread between buy and sell prices. Moving coins off an exchange can cost a network fee. Compare the total before you count any gain." },
    { label: "Liquidity", text: <>About {usdCompact(c.volume_24h_usd)} traded in the last day{turnover != null ? `, ${turnover.toFixed(1)}% of its market value` : ""}. Thin trading means wide spreads and big jumps when someone sells. See <Term id="liquidity">liquidity</Term>.</> },
    { label: "Concentration", text: supply != null ? `${supply.toFixed(0)}% of the most coins that can ever exist are in circulation. New supply and large holders selling can push the price down.` : "Check how much of the supply insiders or the founders hold, and when locked coins are released. New supply can push the price down." },
    { label: "History", text: h?.stats ? `Over the last ${h.stats.days} days its worst fall from a high was ${pctText(h.stats.max_drawdown_pct)} and it moved 10% or more in a day ${h.stats.big_days} times.` : `Its highest price was ${usd(c.ath_usd)} on ${day(c.ath_date)}; it is ${pctText(c.ath_change_pct)} from there. A short history says little about the future.` },
  ];
}

export function Crypto() {
  const [doc, error] = useMarket(loadCrypto);
  const majors = useMemo(() => (doc?.coins ?? []).filter((c) => doc?.history[c.id]), [doc]);
  const [pick, setPick] = useState("bitcoin");
  if (!doc) return <Loading error={error} what="crypto" />;
  const coin = majors.find((c) => c.id === pick) ?? majors[0];
  const hist = coin ? doc.history[coin.id] : undefined;
  const s = hist?.stats;
  const btc = doc.history.bitcoin?.stats;

  const follow = (c: Coin) => {
    if (c.price_usd == null) return;
    addPractice({ kind: "coin", symbol: c.symbol, name: c.name, coinId: c.id, amount: 1000, entryPrice: c.price_usd, entryDate: localDay() });
    toast(`Added a practice position of $1,000 in ${c.name}. No real money.`, { action: { label: "Open Practice", run: () => { window.location.hash = "#/markets/practice"; } } });
  };

  const cols: Column<Coin>[] = [
    { key: "rank", header: "#", sort: (c) => c.rank, render: (c) => <span className="mk-num muted">{c.rank ?? ""}</span>, align: "left", width: 40 },
    { key: "name", header: "Coin", sort: (c) => c.name, align: "left", render: (c) => <span><span className="mk-name">{c.name}</span> <span className="mk-sym">{c.symbol}</span></span> },
    { key: "price", header: "Price", sort: (c) => c.price_usd, render: (c) => <span className="mk-num">{usd(c.price_usd)}</span> },
    { key: "d1", header: "1 day", sort: (c) => c.change_24h_pct, render: (c) => <span className="mk-num">{pctText(c.change_24h_pct)}</span> },
    { key: "d30", header: "30 days", sort: (c) => c.change_30d_pct, render: (c) => <span className="mk-num">{pctText(c.change_30d_pct)}</span> },
    { key: "y1", header: "1 year", sort: (c) => c.change_1y_pct, render: (c) => <span className="mk-num">{pctText(c.change_1y_pct)}</span> },
    { key: "peak", header: "From its high", sort: (c) => c.ath_change_pct, render: (c) => <span className="mk-num" title={`High ${usd(c.ath_usd)} on ${day(c.ath_date)}`}>{pctText(c.ath_change_pct, 0)}</span> },
    { key: "cap", header: "Market value", sort: (c) => c.market_cap_usd, render: (c) => <span className="mk-num">{usdCompact(c.market_cap_usd)}</span> },
    { key: "vol", header: "Traded, 1 day", sort: (c) => c.volume_24h_usd, render: (c) => <span className="mk-num">{usdCompact(c.volume_24h_usd)}</span> },
    { key: "act", header: "", render: (c) => <Button size="sm" variant="tertiary" onClick={() => follow(c)}>Practice</Button> },
  ];

  return (
    <>
      <Risk>
        Crypto swings far more than stocks. {btc ? <>Even bitcoin, the largest coin, fell {pctText(btc.max_drawdown_pct)} from a high within the last year and had {btc.big_days} days with a move of 10% or more.</> : null}{" "}
        Coins tend to fall together, so owning several does not spread the risk much. Exchanges can fail and coins can be stolen. See <Term id="crypto-volatility">crypto volatility</Term>.
      </Risk>

      {coin && hist && s && (
        <section className="mk-card">
          <div className="mk-card-head">
            <h2>{coin.name} <span className="mk-sym">{coin.symbol}</span></h2>
            <Select label="Coin" value={coin.id} onChange={setPick} options={majors.map((c) => [c.id, c.name] as [string, string])} />
          </div>
          <div className="mk-chart">
            <LineChart series={[{ name: coin.name, color: "var(--series-1)", points: hist.prices }]} height={240} format={(v) => usd(v)} label={`${coin.name} price in US dollars, last ${s.days} days`} />
          </div>
          <div className="mk-stats">
            <Stat label="Price" value={usd(coin.price_usd)} note={`${pctText(coin.change_24h_pct)} in a day`} />
            <Stat label="Over the year" value={pctText(s.return_period_pct)} note={`since ${day(s.first_date)}`} />
            <Stat label="Swing size" term="volatility" value={pctText(s.vol_30d_pct, 0, false)} note="a year, from the last 30 days. Stocks are often near 15%." />
            <Stat label="Worst fall" term="drawdown" value={pctText(s.max_drawdown_pct)} note={`from a high, low on ${day(s.max_drawdown_date)}`} />
            <Stat label="Worst day" value={pctText(s.worst_day_pct)} note={day(s.worst_day)} />
            <Stat label="Best day" value={pctText(s.best_day_pct)} note={day(s.best_day)} />
            <Stat label="10% days" value={String(s.big_days)} note={`days out of ${s.days - 1}`} />
            <Stat label="From its all-time high" value={pctText(coin.ath_change_pct, 0)} note={`high ${usd(coin.ath_usd)}, ${day(coin.ath_date)}`} />
          </div>
          <Checks items={coinChecks(coin, doc)} />
          <Attribution sources={doc.sources} />
        </section>
      )}

      <section style={{ marginTop: 16 }}>
        <div className="mk-card-head"><h2 style={{ margin: 0, fontSize: 16 }}>The 100 largest coins</h2><span className="muted small">by market value, from {day(doc.fetched_at)}</span></div>
        <p className="muted small">Ordered by size, not by gains. Market value is price times coins in circulation. Practice adds a pretend position you can watch; it is not a purchase.</p>
        <div className="mk-table-scroll">
          <DataTable rows={doc.coins} columns={cols} rowKey={(c) => c.id} initialSort={{ key: "rank", dir: "asc" }} dense caption="The 100 largest coins by market value" />
        </div>
        <Attribution sources={doc.sources} />
      </section>
      <Sources sources={doc.sources} />
    </>
  );
}
