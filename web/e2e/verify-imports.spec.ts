// Every real export in tests/fixtures/verify/real (SOURCES.md) and every copied layout in
// tests/fixtures/verify/layout, uploaded on /verify/ the way a trader would: the format is found,
// the trades are counted, and the record is judged. Signed out, so no price file is fetched and
// nothing is sent: each upload is checked in the browser only.
import { resolve } from "node:path";
import type { Page } from "@playwright/test";
import { expect, open, test } from "./fixtures";

const FILES: [string, string, string | null][] = [
  ["real/alpaca-activities-alpacapy.json", "Alpaca activities, 1 closed trade", "Not enough data"],
  ["real/binance-spot-trades-market-moonstats-2022.csv", "Binance spot trade history, 5 closed trades", "Not enough data"],
  ["real/binance-statement-fingather-2022.csv", "Binance account statement, 0 closed trades", null],
  ["real/coinbase-pro-fills-gocryptoadmin-2019.csv", "Coinbase fills, 2 closed trades", "Not enough data"],
  ["real/coinbase-transactions-canion3d-2022.csv", "Coinbase transaction report, 2 closed trades", "Not enough data"],
  ["real/coinbase-transactions-delta-2024.csv", "Coinbase transaction report, 1 closed trade", "Not enough data"],
  ["real/coinbase-transactions-dickwolff-2025.csv", "Coinbase transaction report, 1 closed trade", "Not enough data"],
  ["real/ctrader-abhidp-2026.xlsx", "cTrader history, 51 closed trades", "Does not hold up"],
  ["real/ibkr-activity-maisvalias.csv", "Interactive Brokers activity statement, 1 closed trade", "Not enough data"],
  ["real/ibkr-flex-agusalex-taxcalc.csv", "Interactive Brokers Flex trades, 4 closed trades", "Not enough data"],
  ["real/ibkr-flex-fingather.csv", "Interactive Brokers Flex trades, 0 closed trades", null],
  ["real/kraken-ledgers-vergi-2021.csv", "Trade list", null],
  ["real/kraken-trades-gocryptoadmin-2017.csv", "Kraken trades, 7 closed trades", "Not enough data"],
  ["real/mt4_detailed_statement.htm", "MetaTrader 4 statement, 8 closed trades", "Not enough data"],
  ["real/mt4_strategy_tester_id.htm", "MetaTrader 4 Strategy Tester report, 10 closed trades", "Could be luck"],
  ["real/mt5_open_xml_positions.xlsx", "MetaTrader 5 report, closed positions, 14 closed trades", "Not enough data"],
  ["real/mt5_report_history_en.html", "MetaTrader 5 report, closed positions, 10 closed trades", "Not enough data"],
  ["real/mt5_report_history_en.utf16le.html", "MetaTrader 5 report, closed positions, 10 closed trades", "Not enough data"],
  ["real/mt5_report_history_es.html", "MetaTrader 5 report, closed positions, 2 closed trades", "Not enough data"],
  ["real/mt5_strategy_tester.html", "MetaTrader 5 Strategy Tester report, 10 closed trades", "Not enough data"],
  ["real/myfxbook_export.csv", "Myfxbook trade history, 10 closed trades", "Not enough data"],
  ["real/ninjatrader-toinetrades-2025.csv", "NinjaTrader trades, 9 closed trades", "Not enough data"],
  ["real/tos-redbean87.csv", "thinkorswim trade history, 7 closed trades", "Not enough data"],
  ["real/tradingview-aleksdrozy-2025.csv", "TradingView list of trades, 7 closed trades", "Not enough data"],
  ["real/tradingview-pineforge-2026.csv", "TradingView list of trades, 6 closed trades", "Not enough data"],
  ["real/tradovate-orders-drasticstatic-2026.csv", "Tradovate orders, 1 closed trade", "Not enough data"],
  ["real/tradovate-positionhistory-tradetally-2026.csv", "Tradovate position history, 5 closed trades", "Not enough data"],
  ["layout/binance-futures.csv", "Binance futures trade history, 2 closed trades", "Not enough data"],
  ["layout/binance-spot-pair.csv", "Binance spot trade history, 2 closed trades", "Not enough data"],
  ["layout/bybit-closed-positions.csv", "Bybit closed positions, 3 closed trades", "Not enough data"],
  ["layout/ibkr-flex-wrapped.csv", "Interactive Brokers Flex trades, 1 closed trade", "Not enough data"],
  ["layout/kraken-trades-2026.csv", "Kraken trades, 1 closed trade", "Not enough data"],
  ["layout/thinkorswim-spreads-futures.csv", "thinkorswim trade history, 3 closed trades", "Not enough data"],
  ["layout/tradovate-performance.csv", "Tradovate performance, 3 closed trades", "Not enough data"],
];

test.use({ signedIn: false });

async function upload(page: Page, file: string) {
  await page.locator(".vp-tool input[type=file]").setInputFiles(resolve(import.meta.dirname, "../tests/fixtures/verify", file));
}

test.describe("real exports on /verify/", () => {
  for (const [file, found, verdict] of FILES) {
    test(`${file} is read and judged`, async ({ page }) => {
      const sent: string[] = [];
      page.on("request", (r) => { if (r.postData()) sent.push(r.url()); });
      await open(page, "/verify/");
      await upload(page, file);
      await expect(page.locator(".vf-found")).toContainText(found);
      const check = page.getByRole("button", { name: "Check this record" });
      if (verdict) {
        await check.click();
        await expect(page.locator("#vf-verdict")).toHaveText(verdict);
      } else {
        await expect(check).toBeDisabled();
        await expect(page.locator(".vf-warn").first()).toBeVisible();
      }
      expect(sent).toEqual([]);
    });
  }

  test("a ledger is refused with what to export instead", async ({ page }) => {
    await open(page, "/verify/");
    await upload(page, "real/kraken-ledgers-vergi-2021.csv");
    await expect(page.getByText("This is a Kraken ledger (ledgers.csv), which lists money moving, not trades.")).toBeVisible();
  });

  test("a bad row is named by its line", async ({ page }) => {
    await open(page, "/verify/");
    await page.locator(".vp-tool input[type=file]").setInputFiles({ name: "trades.csv", mimeType: "text/csv", buffer: Buffer.from("close_time,pnl\n2024-01-02,10\n2024-13-45,5\n") });
    await expect(page.getByText('1 row was skipped. Line 3: the close date "2024-13-45" is not a date we can read.')).toBeVisible();
  });
});
