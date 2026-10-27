// The month view of daily demo P&L: a grid of days, Monday to Sunday, with a week total
// column. Each day's colour is green for a gain and red for a loss, stronger the closer it
// is to the month's largest day. The signed amount is always written in the cell, so the
// colour is never the only sign. Arrow keys move between days; Enter or Space opens one.
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { addDays, monthLabel, usd, usdShort, WEEKDAYS, type DayCell, type MonthView } from "../lib/tradeProfile/logic";

const tone = (v: number) => (v > 0.004 ? "pos" : v < -0.004 ? "neg" : "zero");

export function MonthCalendar({ view, onOpen }: { view: MonthView; onOpen: (date: string) => void }) {
  const days = view.weeks.flatMap((w) => w.cells.filter((c): c is DayCell => c != null));
  const firstTraded = days.find((d) => d.trades > 0)?.date ?? days[0].date;
  const [focus, setFocus] = useState(firstTraded);
  const grid = useRef<HTMLTableElement>(null);
  const moved = useRef(false);

  // A new month starts the keyboard on its first day with trades.
  useEffect(() => { setFocus(firstTraded); }, [view.month, firstTraded]);
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    grid.current?.querySelector<HTMLButtonElement>(`[data-date="${focus}"]`)?.focus();
  }, [focus]);

  const onKey = (e: KeyboardEvent<HTMLTableElement>) => {
    const col = (WEEKDAYS.length + new Date(`${focus}T00:00:00Z`).getUTCDay() - 1) % 7;
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -col, End: 6 - col };
    if (!(e.key in step)) return;
    e.preventDefault();
    const next = addDays(focus, step[e.key]);
    if (!days.some((d) => d.date === next)) return;
    moved.current = true;
    setFocus(next);
  };

  const month = monthLabel(view.month);
  return (
    <div className="table-wrap tp-cal-wrap">
      <table ref={grid} className="tp-cal" role="grid" aria-label={`Daily P&L, ${monthLabel(view.month)}`} onKeyDown={onKey}>
        <thead>
          <tr>
            {WEEKDAYS.map((d) => <th key={d} scope="col"><abbr title={d}>{d.slice(0, 3)}</abbr></th>)}
            <th scope="col" className="tp-cal-week">Week</th>
          </tr>
        </thead>
        <tbody>
          {view.weeks.map((w, i) => (
            <tr key={i}>
              {w.cells.map((c, j) => c == null ? <td key={j} className="tp-day-out" /> : (
                <td key={j}>
                  {/* The name reads the visible day and amount in place, with the weekday, month and trade count around them for screen readers (WCAG 2.5.3). */}
                  <button type="button" data-date={c.date} tabIndex={c.date === focus ? 0 : -1}
                    className={`tp-day ${c.trades ? tone(c.pnl) : "none"}`} style={{ "--heat": c.heat.toFixed(3) } as CSSProperties}
                    title={c.trades ? `${usd(c.pnl)} from ${c.trades} closed ${c.trades === 1 ? "trade" : "trades"}` : undefined}
                    onFocus={() => setFocus(c.date)} onClick={() => onOpen(c.date)}>
                    <span className="sr-only">{WEEKDAYS[j]}, </span>
                    <span className="tp-day-n">{c.day}</span>
                    <span className="sr-only"> {month}: </span>
                    {c.trades
                      ? <><span className="tp-day-v">{usdShort(c.pnl)}</span><span className="sr-only"> from {c.trades} closed {c.trades === 1 ? "trade" : "trades"}</span></>
                      : <span className="sr-only">no closed trades</span>}
                  </button>
                </td>
              ))}
              <td className={`tp-cal-week ${w.trades ? tone(w.pnl) : ""}`}>
                {w.trades ? <><span className="sr-only">Week total </span>{usdShort(w.pnl)}</> : <span className="tp-dim">$0</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
