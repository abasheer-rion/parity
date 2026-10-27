// Settings > Trade profile, signed in, with a demo account and its fills in the Supabase
// stand-in: the month view of daily P&L, a day's trades, the ranked trades, opting in to
// the demo leaderboard with a handle and country, the pinned You row, the region filter,
// and an axe check of the three sections. The stand-in does not compute the views, so the
// board (leaderboard_public) and your own numbers (my_trade_stats) are seeded as rows.
import AxeBuilder from "@axe-core/playwright";
import { expect, open, settled, test } from "./fixtures";

const ACCOUNT = "00000000-0000-4000-8000-0000000000c1";
const account = {
  id: ACCOUNT, name: "Demo account", starting_cash: 100000, cash: 100395, fee_bps: 1, fee_min: 1, slippage_bps: 5,
  strategy_source: null, strategy_key: null, strategy_name: null, strategy_spec: null, strategy_start: null, strategy_capital: null, strategy_attached_at: null,
  reset_at: null, created_at: "2026-10-01T10:00:00Z",
};
const fill = (n: number, symbol: string, side: "buy" | "sell", qty: number, price: number, bar_date: string, realized_pnl: number | null) => ({
  id: `00000000-0000-4000-8000-0000000001${String(n).padStart(2, "0")}`, account_id: ACCOUNT, order_id: `o${n}`, symbol, side, qty, price, fee: 1, bar_date, realized_pnl,
  created_at: `${bar_date}T12:00:00Z`,
});
// Returns: US market 120 / 6879 = 1.74%, BTC -40 / 639 = -6.26%, EUR/USD 15 / 94 = 15.96%, BTC 300 / 349 = 85.96%.
const fills = [
  fill(1, "eq.US_MKT", "buy", 10, 687.8, "2026-10-02", null),
  fill(2, "eq.US_MKT", "sell", 10, 700, "2026-10-06", 120),
  fill(3, "crypto.BTC", "sell", 0.01, 60000, "2026-10-07", -40),
  fill(4, "fx.EUR", "sell", 100, 1.1, "2026-10-07", 15),
  fill(5, "crypto.BTC", "sell", 0.01, 65000, "2026-10-14", 300),
];
const trader = (handle: string, rank: number, country: string, region: string, score: number) => ({
  period: "all", rank, handle, display_name: null, initials: handle.slice(0, 2).toUpperCase(), country, region, trades: 40, active_days: 20,
  total_return: 0.05, risk_adjusted: score, win_rate: 0.6, max_drawdown: 0.03, min_trades: 20, is_you: false,
});

test("trade profile: calendar, a day's trades, ranking, opting in and the board by region", async ({ page, db }) => {
  db.seed("paper_accounts", [account]);
  db.seed("paper_fills", fills);
  db.seed("leaderboard_public", [
    trader("alpha_fx", 1, "US", "North America", 3.1), trader("bravo", 2, "DE", "Europe", 2.4),
    trader("charlie", 3, "FR", "Europe", 1.5), trader("delta", 4, "JP", "Asia", 1.2),
  ]);
  db.seed("my_trade_stats", [{
    period: "all", trades: 4, active_days: 3, total_return: 0.00395, risk_adjusted: 0.9, win_rate: 0.75, max_drawdown: 0.0004, min_trades: 20,
    qualifies: false, on_leaderboard: false, board_rank: null,
  }]);

  await open(page, "/app/#/settings/trade-profile");
  await settled(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Trade profile");

  // The month view opens on the month of the latest closed trade.
  const cal = page.getByTestId("trade-calendar");
  await expect(cal).toContainText("October 2026");
  const grid = cal.getByRole("grid", { name: "Daily P&L, October 2026" });
  await expect(grid.getByRole("button", { name: /^Tuesday,\s*6\s*October 2026:\s*\+\$120\s*from 1 closed trade$/ })).toBeVisible();
  await expect(grid.getByRole("button", { name: /^Wednesday,\s*7\s*October 2026:\s*-\$25\s*from 2 closed trades$/ })).toContainText("-$25");
  await expect(cal).toContainText("Month total");
  await expect(cal).toContainText("+$395.00");

  // Keyboard: Enter on a day opens its trades.
  const day7 = grid.getByRole("button", { name: /^Wednesday,\s*7\s*October/ });
  await day7.focus();
  await page.keyboard.press("ArrowRight");
  await expect(grid.getByRole("button", { name: /^Thursday,\s*8\s*October/ })).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Wednesday, 7 October 2026" });
  await expect(dialog).toContainText("2 closed trades, -$25.00 after fees.");
  await expect(dialog).toContainText("BTC");
  await expect(dialog).toContainText("EUR/USD");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  // A click opens a day too.
  await grid.getByRole("button", { name: /^Wednesday,\s*14\s*October/ }).click();
  await expect(page.getByRole("dialog", { name: "Wednesday, 14 October 2026" })).toContainText("+$300.00");
  await page.keyboard.press("Escape");

  // Ranked trades: best P&L first, then by return.
  const ranked = page.getByTestId("ranked-trades");
  const firstCells = () => ranked.locator("tbody tr").nth(1).locator("td").nth(1);
  await expect(ranked.locator("tbody tr").first()).toContainText("BTC");
  await expect(firstCells()).toContainText("US market");
  await ranked.getByRole("button", { name: /^Return/ }).click();
  await expect(firstCells()).toContainText("EUR/USD");
  await expect(ranked.locator("tbody tr").nth(1)).toContainText("+15.96%");
  await ranked.getByRole("combobox", { name: "Market" }).selectOption("Crypto");
  await expect(ranked.locator("tbody tr")).toHaveCount(2);

  // The leaderboard: opt in with a handle and a country.
  const board = page.getByTestId("leaderboard");
  await expect(board).toContainText("Demo money");
  await expect(board).toContainText("Past demo results do not predict future results.");
  const toggle = board.getByRole("switch", { name: "Show me on the leaderboard" });
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();
  await board.getByRole("button", { name: "Save leaderboard settings" }).click();
  await expect(board.getByRole("alert").first()).toContainText("Choose a handle");
  await board.getByRole("textbox", { name: "Public handle" }).fill("e2e_trader");
  await board.getByRole("combobox", { name: "Country" }).selectOption("GB");
  await board.getByRole("button", { name: "Save leaderboard settings" }).click();
  await expect.poll(() => db.rows("trader_profiles")).toEqual([expect.objectContaining({ handle: "e2e_trader", country: "GB", on_leaderboard: true, display_name: null })]);

  const table = board.getByRole("table", { name: "Demo leaderboard" });
  const you = table.locator("tbody tr").first();
  await expect(you).toContainText("@e2e_trader");
  await expect(you).toContainText("You");
  await expect(you).toContainText("Not ranked");
  await expect(you).toContainText("16 more trades to qualify");
  await expect(table).toContainText("@alpha_fx");
  await expect(table.locator("tbody tr").nth(1)).toContainText("Less likely to be luck alone");

  // Europe only: ranks start again at 1 inside the region.
  await board.getByRole("combobox", { name: "Region" }).selectOption("Europe");
  await expect(table.locator("tbody tr")).toHaveCount(3);
  await expect(table.locator("tbody tr").nth(1)).toContainText("@bravo");
  await expect(table.locator("tbody tr").nth(1).locator("td").first()).toHaveText("1");
  await expect(table.locator("tbody tr").nth(2).locator("td").first()).toHaveText("2");
  await expect(table.locator("tbody tr").nth(2)).toContainText("Could be luck");
  await expect(table).not.toContainText("@alpha_fx");

  // No email anywhere on the page.
  await expect(page.locator("main")).not.toContainText("e2e@example.com");

  const axe = await new AxeBuilder({ page })
    .include("[data-testid=trade-calendar]").include("[data-testid=ranked-trades]").include("[data-testid=leaderboard]")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"]).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
});

test("trade profile without a demo account says how to start", async ({ page }) => {
  await open(page, "/app/#/settings/trade-profile");
  await settled(page);
  await expect(page.getByText("No demo account yet")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Parity Trade" })).toBeVisible();
  await expect(page.getByTestId("leaderboard")).toContainText("Demo money");
});
