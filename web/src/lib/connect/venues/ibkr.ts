// Interactive Brokers through the Flex Web Service (DEC-0091). The person makes an Activity
// Flex Query with the Trades section (Executions) and a Flex Web Service token in Client
// Portal, and gives us the token and the query id. Flex has two calls, SendRequest and
// GetStatement, and both only fetch reports: a Flex token cannot trade or move money, and
// it is not the person's IB login. So there is no permission to check; the check is that
// the token and query work.
//
// Official docs (fetched 3 November 2026):
//   https://www.interactivebrokers.com/docs/web-api/api-reference/send-request
//   https://www.interactivebrokers.com/docs/web-api/api-reference/get-statement
//   https://www.interactivebrokers.com/docs/web-api/flex-web-service/error-codes
// Limits: 1 request a second and 10 a minute per token (error 1018); at most 365 days per
// request; every request needs a User-Agent; the returned <url> is ignored, as the docs say.
// The statement comes in the format set on the query: CSV is read by the same reader as an
// uploaded Flex file (tested on real exports, DEC-0084); XML is read by its Trade elements.
import { readTable } from "../../verify/csv";
import { parseTable } from "../../verify/parse";
import { tradesSection } from "../../verify/parse/sections";
import type { Table } from "../../verify/types";
import { call } from "../http";
import { ConnectError, text, type Connector, type Range, type VenueCtx, type VenueRead } from "../types";

export interface IbkrCredentials { token: string; queryId: string }

const BASE = "https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService";
const NAME = "Interactive Brokers";
const UA = "Parity/1.0 (+https://paritytrading.app/methodology/)";
/** Flex error codes that mean "not ready yet, ask again shortly". */
const RETRY = new Set(["1001", "1004", "1005", "1006", "1007", "1008", "1009", "1019", "1021"]);

const ERRORS: Record<string, [number, string, "venue_auth" | "venue_limit" | "bad_input" | "venue_down"]> = {
  "1010": [400, "This is a legacy Flex query, which Interactive Brokers no longer runs. Make an Activity Flex Query instead.", "bad_input"],
  "1011": [401, "Interactive Brokers says the account behind this token is inactive.", "venue_auth"],
  "1012": [401, "This Flex token has expired. Make a new one in Client Portal (Reporting, Flex Queries, Flex Web Service Configuration).", "venue_auth"],
  "1013": [401, "This Flex token only works from certain IP addresses, and ours is not one of them. Make a token without an address limit.", "venue_auth"],
  "1014": [400, "Interactive Brokers says this query id is not valid. Check the number under the query's Info button.", "bad_input"],
  "1015": [401, "Interactive Brokers says this Flex token is not valid. Copy it again from Flex Web Service Configuration.", "venue_auth"],
  "1016": [400, "Interactive Brokers says the account in this query is not valid.", "bad_input"],
  "1017": [502, "Interactive Brokers lost the report it was making. Try again.", "venue_down"],
  "1018": [429, "Interactive Brokers allows 10 requests a minute for a token. Wait a minute and try again.", "venue_limit"],
  "1020": [400, "Interactive Brokers could not read the request. Check the token and the query id.", "bad_input"],
  "1025": [429, "Interactive Brokers has paused this token after too many failed tries. Wait and try again later.", "venue_limit"],
};

const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1]?.trim() ?? null;

function failure(xml: string): ConnectError | "retry" | null {
  if (tag(xml, "Status") !== "Fail") return null;
  const code = tag(xml, "ErrorCode") ?? "";
  if (RETRY.has(code)) return "retry";
  const e = ERRORS[code];
  return e ? new ConnectError(e[0], e[1], e[2]) : new ConnectError(502, `Interactive Brokers could not make the report (error ${code.replace(/\D/g, "").slice(0, 6) || "unknown"}).`, "venue_down");
}

const ymd = (d: string) => d.replace(/-/g, "");

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const unescape = (s: string) => s.replace(/&(amp|lt|gt|quot|apos);/g, (_, e: string) => ENTITIES[e]);

/** The attributes of every <name .../> element, in order. Enough for Flex's flat XML. */
export function elements(xml: string, name: string): Record<string, string>[] {
  const out: Record<string, string>[] = [];
  for (const m of xml.matchAll(new RegExp(`<${name}\\s([^>]*?)/?>`, "g"))) {
    const attrs: Record<string, string> = {};
    for (const a of m[1].matchAll(/([A-Za-z_][\w.-]*)="([^"]*)"/g)) attrs[a[1]] = unescape(a[2]);
    out.push(attrs);
  }
  return out;
}

/** Flex XML attribute names and the column names of the same fields in a Flex CSV. */
const XML_COLUMNS: [string, string][] = [
  ["accountId", "ClientAccountID"], ["currency", "CurrencyPrimary"], ["fxRateToBase", "FXRateToBase"], ["assetCategory", "AssetClass"],
  ["symbol", "Symbol"], ["multiplier", "Multiplier"], ["dateTime", "DateTime"], ["tradeDate", "TradeDate"], ["quantity", "Quantity"],
  ["tradePrice", "TradePrice"], ["proceeds", "Proceeds"], ["taxes", "Taxes"], ["ibCommission", "IBCommission"],
  ["ibCommissionCurrency", "IBCommissionCurrency"], ["buySell", "Buy/Sell"], ["fifoPnlRealized", "FifoPnlRealized"],
  ["openCloseIndicator", "Open/CloseIndicator"], ["levelOfDetail", "LevelOfDetail"],
];

/** A Flex XML statement as the same table a Flex CSV gives, so one reader handles both. */
export function xmlTable(xml: string): Table {
  const trades = elements(xml, "Trade").filter((t) => !t.levelOfDetail || t.levelOfDetail === "EXECUTION");
  const statementAccount = elements(xml, "FlexStatement")[0]?.accountId ?? "";
  return {
    headers: XML_COLUMNS.map(([, h]) => h),
    rows: trades.map((t) => XML_COLUMNS.map(([a]) => (a === "accountId" ? t.accountId ?? statementAccount : t[a] ?? ""))),
  };
}

/** The account ids in a statement's table (before personal columns are dropped). */
export function accountsIn(t: Table): string[] {
  const i = t.headers.findIndex((h) => /^client ?account ?id$/i.test(h.trim()));
  if (i < 0) return [];
  return [...new Set(t.rows.map((r) => (r[i] ?? "").trim()).filter(Boolean))];
}

export function statementTable(body: string): Table {
  const clean = body.replace(/^﻿/, "").trim();
  if (clean.startsWith("<")) return xmlTable(clean);
  return tradesSection(clean) ?? readTable(clean);
}

async function flex(ctx: VenueCtx, url: string): Promise<string> {
  const res = await call(ctx, url, { headers: { "User-Agent": UA, Accept: "text/xml, text/plain, text/csv" } }, { venue: NAME, retries: 1 });
  if (!res.ok) throw new ConnectError(502, `Interactive Brokers answered with error ${res.status}. Try again later.`, "venue_down");
  return res.text();
}

export const ibkr: Connector<IbkrCredentials> = {
  id: "ibkr",
  credentials(raw) {
    const r = (raw ?? {}) as Record<string, unknown>;
    return {
      token: text(r.token, "the Flex token", /^[A-Za-z0-9]{8,64}$/, 64),
      queryId: text(r.queryId, "the query id", /^\d{3,12}$/, 12),
    };
  },
  // Nothing to refuse: a Flex token can only fetch reports. read() proves it works.
  async check() {},
  async read(c, range: Range, ctx): Promise<VenueRead> {
    const days = (Date.parse(range.to) - Date.parse(range.from)) / 86_400_000;
    if (days > 364) throw new ConnectError(400, "Interactive Brokers sends at most 365 days in one report. Pick a range of a year or less.");
    const send = `${BASE}/SendRequest?t=${encodeURIComponent(c.token)}&q=${encodeURIComponent(c.queryId)}&v=3&fd=${ymd(range.from)}&td=${ymd(range.to)}`;
    let xml = "";
    for (let i = 0; i < 3; i++) {
      xml = await flex(ctx, send);
      const f = failure(xml);
      if (f === "retry") { await ctx.sleep(3_000); continue; }
      if (f) throw f;
      break;
    }
    const ref = tag(xml, "ReferenceCode");
    if (!ref || !/^\d{1,20}$/.test(ref)) throw new ConnectError(502, "Interactive Brokers did not start the report. Try again in a minute.", "venue_down");
    // The report takes a few seconds to make. At most 10 calls a minute per token, so wait
    // at least 2 seconds between tries.
    let body = "";
    for (let i = 0; ; i++) {
      await ctx.sleep(i === 0 ? 2_000 : 4_000);
      body = await flex(ctx, `${BASE}/GetStatement?t=${encodeURIComponent(c.token)}&q=${ref}&v=3`);
      const f = body.trimStart().startsWith("<FlexStatementResponse") ? failure(body) : null;
      if (f === "retry") {
        if (i >= 5 || ctx.now() + 6_000 > ctx.deadline) throw new ConnectError(504, "Interactive Brokers is still making the report. Try again in a minute.", "venue_down");
        continue;
      }
      if (f) throw f;
      break;
    }
    const table = statementTable(body);
    if (!table.rows.length) throw new ConnectError(422, "The report has no trades. Check that the Flex query includes the Trades section with Executions, and the date range.");
    const accounts = accountsIn(table);
    if (accounts.length === 0) throw new ConnectError(422, "Add Account ID to the Trades section of the Flex query, so the record can name the account (we keep only a one-way code of it).");
    if (accounts.length > 1) throw new ConnectError(422, `This Flex query covers ${accounts.length} accounts. Make a query for one account, so the record is one account's.`);
    const parsed = parseTable(table);
    if (parsed.format !== "ibkr") throw new ConnectError(422, "The report is not a Flex trades report we can read. Use an Activity Flex Query with the Trades section, in CSV or XML.");
    return {
      account: accounts[0],
      // Interactive Brokers' paper accounts start with D (DU... in its own samples).
      env: /^D[UF]\d+$/.test(accounts[0]) ? "paper" : "live",
      trades: parsed.trades ?? [],
      allowShort: true,
      sameAs: "ibkr",
      notes: [...parsed.warnings, ...(parsed.notes ?? [])],
    };
  },
};
