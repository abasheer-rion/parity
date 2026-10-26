// Bot Battle's live numbers (DEC-0035): at the last frame they must match what the engine
// worked out for the whole run, and they must only ever use trades closed by frame k.
// The fixture is one short made-up path from `parity.bots._replay`.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { expectancyLine, money, statsAt, weeksText, type BotRunFile } from "../src/lib/botStats";

const run = JSON.parse(readFileSync(join(import.meta.dirname, "fixtures/bots-run.json"), "utf8")) as BotRunFile;

describe("statsAt", () => {
  const last = run.labels.length - 1;
  for (const [id, track] of Object.entries(run.runs)) {
    it(`${id}: matches the engine's summary on the last frame`, () => {
      const s = statsAt(track, last);
      const e = track.summary;
      expect(s.trades).toBe(e.trades);
      expect(s.wins).toBe(e.wins);
      if (e.win_rate != null) expect(s.winRate).toBeCloseTo(e.win_rate, 4);
      expect(s.avgWin).toBeCloseTo(e.avg_win, -1);
      expect(s.avgLoss).toBeCloseTo(e.avg_loss, -1);
      if (e.profit_factor) expect(s.profitFactor! / e.profit_factor).toBeCloseTo(1, 2);
      else if (e.profit_factor === 0) expect(s.profitFactor).toBe(0);
      expect(s.equity / e.final).toBeCloseTo(1, 3);
      expect(s.worst).toBeCloseTo(e.max_drawdown * 100, 0);
    });
  }

  it("counts only trades closed by the frame shown", () => {
    const track = run.runs.scalper;
    const k = Math.floor(last / 2);
    const s = statsAt(track, k);
    expect(s.trades).toBe(track.trades.filter((t) => t[0] <= k).length);
    expect(statsAt(track, 0).trades).toBeLessThanOrEqual(s.trades);
  });

  it("writes money, weeks and the expectancy line plainly", () => {
    expect(money(12345)).toBe("$12k");
    expect(money(-2_500_000)).toBe("-$2.5m");
    expect(money(950)).toBe("$950");
    expect(weeksText(0)).toBe("none");
    expect(weeksText(10)).toBe("10 wks");
    expect(weeksText(156)).toBe("3.0 yrs");
    const line = expectancyLine(statsAt(run.runs.martingale, last));
    expect(line).toMatch(/^\d+\.\d% x \$[\d,.km]+ - \d+\.\d% x \$[\d,.km]+ = -?\$[\d,.km]+ a trade$/);
    expect(line).not.toMatch(/[—–]/);
  });
});
