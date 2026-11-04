// A batch row's full Verify report (DEC-0087, DEC-0089): the account's own trades go through
// Verify's checks in this browser, and the report opens in a new tab with everything in the
// address after "#", so the trader's data still never reaches Parity.
import { checkFile } from "../lib/verify/checks";
import { encodeReport } from "../lib/verify/report/link";
import { reportFrom } from "../lib/verify/report/model";
import type { AccountInput, AccountResult } from "../lib/screen/score";
import type { RangeOutcome } from "../lib/verify/range/client";

export async function accountReportUrl(a: AccountInput, row: AccountResult, defaultBalance: number, method: string, ranges?: RangeOutcome | null): Promise<string> {
  const r = checkFile({
    ranges,
    parsed: { format: "trades", table: { headers: [], rows: [] }, mapping: {}, dropped: [], trades: a.trades, warnings: [], backtestExport: false },
    answers: { kind: "real", balance: a.balance && a.balance > 0 ? a.balance : defaultBalance, tries: Math.max(1, a.tries ?? 1), claim: {}, noCashflows: true },
    prices: null, triesDefaulted: a.tries == null,
  });
  const d = reportFrom({ ...r, what: `Challenge account ${a.id}` }, { prices: "not_needed", screen: { verdict: row.label, reason: row.reason, method, account: a.id } });
  return `/verify/report/#r=${await encodeReport(d)}`;
}

/** Opens the report in a new tab. The tab opens inside the click, so browsers allow it, and gets its address when ready. */
export function openAccountReport(make: () => Promise<string>): void {
  const w = window.open("about:blank", "_blank");
  void make().then((url) => {
    if (w) { w.opener = null; w.location.href = url; } else window.location.href = url;
  }, () => w?.close());
}
