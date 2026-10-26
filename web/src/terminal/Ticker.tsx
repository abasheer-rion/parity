// The ticker tape: the week's most unusual moves (largest |z|) scrolling along the
// bottom. Hover pauses it; with reduced motion it stands still and scrolls by hand.
import { useTerm } from "./context";
import { fmtChg, fmtLast, fmtNum, tone } from "./fmt";

export function Ticker() {
  const t = useTerm();
  if (t.index.status !== "ok") {
    return <div className="term-ticker idle" aria-label="Ticker">{t.index.status === "loading" ? "Loading markets" : "No market data yet"}</div>;
  }
  const items = [...t.index.data.series]
    .filter((s) => s.last != null)
    .sort((a, b) => Math.abs(b.z ?? 0) - Math.abs(a.z ?? 0))
    .slice(0, 28);
  if (!items.length) return <div className="term-ticker idle">No moves to show</div>;
  const row = (dup: boolean) => (
    <ul className="term-tape-row" aria-hidden={dup || undefined}>
      {items.map((s) => (
        <li key={s.key}>
          <button type="button" tabIndex={dup ? -1 : 0} onClick={() => t.run(s.short)} title={`${s.label}: open its detail`}>
            <b>{s.short}</b> {fmtLast(s.last)} <span className={tone(s.chg?.w1)}>{fmtChg(s.chg?.w1, s.kind)} 1W</span>
            {s.z != null && <span className="term-tape-z">z {fmtNum(s.z, 1, true)}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
  return (
    // A tape that scrolls by design, cut at the screen's edge: the layout check skips it.
    <div className="term-ticker" aria-label="Biggest moves this week" data-layout-ignore>
      <div className="term-tape" style={{ ["--tape-s" as string]: `${Math.max(40, items.length * 4)}s` }}>
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
