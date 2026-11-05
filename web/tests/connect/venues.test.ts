// @vitest-environment node
// The read-only connectors against recorded venue answers (DEC-0091): each asks the venue
// what the key may do and refuses anything that can trade, move or withdraw money, signs
// requests the way the venue documents, pages through history, and turns fills into the same
// trades an uploaded file gives. No request leaves the machine.
import { describe, expect, it } from "vitest";
import { p256 } from "@noble/curves/nist.js";
import { fromB64url, utf8 } from "../../src/lib/connect/bytes";
import { buildRecord } from "../../src/lib/connect/record";
import { ConnectError, type VenueRead } from "../../src/lib/connect/types";
import { alpaca, authorizeUrl, exchangeCode } from "../../src/lib/connect/venues/alpaca";
import { binance, binanceUs, judgeRestrictions } from "../../src/lib/connect/venues/binance";
import { bybit, judgeKey } from "../../src/lib/connect/venues/bybit";
import { coinbase, ecPrivateKey, requestJwt } from "../../src/lib/connect/venues/coinbase";
import { ibkr, statementTable, accountsIn } from "../../src/lib/connect/venues/ibkr";
import { judgePermissions, kraken, sign } from "../../src/lib/connect/venues/kraken";
import { ctx, fx, json, KRAKEN_DOC_SECRET, realFx, recorded, testEcKey, text } from "./helpers";
import { fromB64 } from "../../src/lib/connect/bytes";

const RANGE = { from: "2026-01-01", to: "2026-01-31" };
const pnls = (r: VenueRead) => {
  const trades = r.trades ?? [];
  return trades.map((t) => Math.round(t.pnl * 100) / 100);
};
async function paired(r: VenueRead) {
  const rec = await buildRecord({ venue: r, venueId: "kraken", range: RANGE, tries: 1, balance: null, userId: "u", seed: new Uint8Array(32).fill(1), prices: null, now: Date.parse("2026-02-03T12:00:00Z") });
  return { pnl: rec.result.card1 ? rec.csv.trim().split("\n").slice(1).map((l) => Math.round(Number(l.split(",").at(-1)) * 100) / 100) : [], rec };
}

describe("Interactive Brokers Flex Web Service", () => {
  const creds = ibkr.credentials({ token: "123456789012345678901234", queryId: "987654" });

  it("asks for the report, waits while it is made, and reads a Flex CSV with the tested reader", async () => {
    const { fetch, seen } = recorded([
      [/SendRequest/, text(fx("ibkr-send-ok.xml"))],
      [/GetStatement/, [text(fx("ibkr-get-1019.xml")), text(realFx("real/ibkr-flex-agusalex-taxcalc.csv"))]],
    ]);
    const c = ctx(fetch);
    const r = await ibkr.read(creds, { from: "2021-10-01", to: "2021-12-31" }, c, {});
    expect(seen[0].url).toContain("/AccountManagement/FlexWebService/SendRequest?t=123456789012345678901234&q=987654&v=3&fd=20211001&td=20211231");
    expect(seen[0].headers["user-agent"]).toMatch(/^Parity\//);
    expect(seen.filter((s) => s.url.includes("GetStatement"))).toHaveLength(2);
    expect(seen[1].url).toContain("q=8123456789");
    // At least 2 seconds between calls: Interactive Brokers allows 10 a minute per token.
    expect(c.slept.every((ms) => ms >= 2_000)).toBe(true);
    expect(r.account).toBe("U1234567");
    expect(r.env).toBe("live");
    expect(r.trades!.map((t) => Math.round(t.pnl * 1e6) / 1e6)).toEqual([58.800975, -63.114351, -32.212754, -109.491287]);
  });

  it("reads a Flex XML statement as the same table", async () => {
    const t = statementTable(fx("ibkr-statement.xml"));
    expect(accountsIn(t)).toEqual(["U7654321"]);
    const { fetch } = recorded([[/SendRequest/, text(fx("ibkr-send-ok.xml"))], [/GetStatement/, text(fx("ibkr-statement.xml"))]]);
    const r = await ibkr.read(creds, RANGE, ctx(fetch), {});
    expect(pnls(r)).toEqual([98, -102]);
  });

  it("says what Interactive Brokers' error codes mean, without the token", async () => {
    const { fetch } = recorded([[/SendRequest/, text(fx("ibkr-fail-1015.xml"))]]);
    const e = await ibkr.read(creds, RANGE, ctx(fetch), {}).catch((x) => x);
    expect(e).toBeInstanceOf(ConnectError);
    expect(e.message).toMatch(/Flex token is not valid/);
    expect(e.message).not.toContain(creds.token);
  });

  it("refuses ranges over 365 days and badly shaped values", async () => {
    await expect(ibkr.read(creds, { from: "2024-01-01", to: "2025-06-01" }, ctx(recorded([]).fetch), {})).rejects.toThrow(/365 days/);
    expect(() => ibkr.credentials({ token: "abc", queryId: "1" })).toThrow(/does not look right/);
    expect(() => ibkr.credentials({ queryId: "123456" })).toThrow("Fill in the Flex token.");
  });
});

describe("Alpaca sign-in", () => {
  it("asks for no scope, which Alpaca documents as read-only", () => {
    const u = new URL(authorizeUrl("client-1", "https://paritytrading.app/api/connect/alpaca/callback", "state-1", "paper"));
    expect(u.origin + u.pathname).toBe("https://app.alpaca.markets/oauth/authorize");
    expect(u.searchParams.get("scope")).toBeNull();
    expect(u.searchParams.get("env")).toBe("paper");
    expect(u.searchParams.get("response_type")).toBe("code");
  });

  it("swaps the code for a token on the server and refuses a token with any scope", async () => {
    const ok = recorded([[/oauth\/token/, json(fx("alpaca-token.json"))]]);
    const token = await exchangeCode(ctx(ok.fetch), { code: "c0de", clientId: "id", clientSecret: "shh-test", redirectUri: "https://x/cb" });
    expect(token).toBe("test-alpaca-access-token-not-real");
    expect(ok.seen[0].body).toContain("grant_type=authorization_code");
    const wide = recorded([[/oauth\/token/, json(fx("alpaca-token-trading.json"))]]);
    await expect(exchangeCode(ctx(wide.fetch), { code: "c0de", clientId: "id", clientSecret: "shh-test", redirectUri: "https://x/cb" })).rejects.toMatchObject({ code: "refused" });
  });

  it("reads fills page by page from the paper account and turns them into fills", async () => {
    const acts = JSON.parse(realFx("real/alpaca-activities-alpacapy.json")) as { transaction_time: string }[];
    const shifted = acts.map((a, i) => ({ ...a, transaction_time: `2026-01-${String(5 + i).padStart(2, "0")}T15:00:00Z` }));
    const { fetch, seen } = recorded([[/\/v2\/account$/, json(fx("alpaca-account.json"))], [/activities\/FILL/, json(shifted)]]);
    const r = await alpaca.read(alpaca.credentials({ accessToken: "test-alpaca-access-token-not-real", env: "paper" }), RANGE, ctx(fetch), {});
    expect(seen[0].url).toBe("https://paper-api.alpaca.markets/v2/account");
    expect(seen[1].headers.authorization).toBe("Bearer test-alpaca-access-token-not-real");
    expect(new URL(seen[1].url).searchParams.get("direction")).toBe("asc");
    expect(r.env).toBe("paper");
    expect(r.account).toBe("PALPACA_123");
    expect(r.fills!.length).toBe(acts.length);
  });
});

describe("Coinbase Advanced Trade", () => {
  const key = testEcKey();
  const raw = { keyName: "organizations/11111111-2222-3333-4444-555555555555/apiKeys/66666666-7777-8888-9999-000000000000", privateKey: key.pem };

  it("reads the EC private key and signs each request with ES256, as Coinbase documents", () => {
    expect(ecPrivateKey(key.pem)).toEqual(key.secret);
    expect(ecPrivateKey(key.pem.replace(/\n/g, "\\n"))).toEqual(key.secret);
    const c = coinbase.credentials(raw);
    const jwt = requestJwt(c, "GET", "/api/v3/brokerage/key_permissions", 1_767_225_600, "abc");
    const [h, b, s] = jwt.split(".");
    const head = JSON.parse(new TextDecoder().decode(fromB64url(h)));
    const body = JSON.parse(new TextDecoder().decode(fromB64url(b)));
    expect(head).toEqual({ alg: "ES256", kid: raw.keyName, nonce: "abc", typ: "JWT" });
    expect(body).toEqual({ iss: "cdp", sub: raw.keyName, nbf: 1_767_225_600, exp: 1_767_225_720, uri: "GET api.coinbase.com/api/v3/brokerage/key_permissions" });
    expect(p256.verify(fromB64url(s), utf8(`${h}.${b}`), key.pub, { prehash: true })).toBe(true);
  });

  it("refuses Ed25519 keys and keys that can trade or transfer", async () => {
    expect(() => coinbase.credentials({ ...raw, privateKey: "bm90IGFuIEVDIGtleQ==" })).toThrow(/ECDSA/);
    const trade = recorded([[/key_permissions/, json(fx("coinbase-permissions-trade.json"))]]);
    await expect(coinbase.check(coinbase.credentials(raw), ctx(trade.fetch))).rejects.toMatchObject({ code: "refused", message: expect.stringMatching(/can trade/) });
    const transfer = recorded([[/key_permissions/, json({ can_view: true, can_trade: false, can_transfer: true })]]);
    await expect(coinbase.check(coinbase.credentials(raw), ctx(transfer.fetch))).rejects.toMatchObject({ code: "refused" });
    const view = recorded([[/key_permissions/, json(fx("coinbase-permissions-view.json"))]]);
    await expect(coinbase.check(coinbase.credentials(raw), ctx(view.fetch))).resolves.toBeUndefined();
  });

  it("follows the cursor, converts sizes given in money, and leaves futures out by name", async () => {
    const { fetch, seen } = recorded([
      [/key_permissions/, json(fx("coinbase-permissions-view.json"))],
      [/historical\/fills/, [json(fx("coinbase-fills-1.json")), json(fx("coinbase-fills-2.json"))]],
    ]);
    const r = await coinbase.read(coinbase.credentials(raw), RANGE, ctx(fetch), {});
    expect(new URL(seen[2].url).searchParams.get("cursor")).toBe("789100");
    expect(r.account).toBe("4444-444444-4444444");
    expect(r.notes[0]).toMatch(/BIT-28JUN26-CDE/);
    const { pnl } = await paired(r);
    expect(pnl).toEqual([97.5, -53.9]);
  });
});

describe("Kraken", () => {
  it("signs requests exactly like Kraken's documented example", async () => {
    const sig = await sign("/0/private/AddOrder", "1616492376594", "nonce=1616492376594&ordertype=limit&pair=XBTUSD&price=37500&type=buy&volume=1.25", fromB64(KRAKEN_DOC_SECRET));
    expect(sig).toBe("4/dpxb3iT4tp/ZCVEwSnEsLxx0bqyhLpdfOpc6fn7OR8+UClSV5n9E6aSS8MPtnRfp32bAb0nmbRn6H8ndwLUQ==");
  });

  it("refuses any permission that is not a query, including names it does not know", () => {
    expect(() => judgePermissions(JSON.parse(fx("kraken-keyinfo-trade.json")).result)).toThrow(/place and change orders, withdraw money/);
    expect(() => judgePermissions({ permissions: ["query-closed-trades", "brand-new-power"] })).toThrow(/brand-new-power/);
    expect(() => judgePermissions({ permissions: ["query-funds"] })).toThrow(/cannot read trades/);
    expect(() => judgePermissions({})).toThrow(/did not tell us/);
    expect(() => judgePermissions(JSON.parse(fx("kraken-keyinfo-read.json")).result)).not.toThrow();
  });

  it("reads trade history with the pair names Kraken publishes", async () => {
    const { fetch, seen } = recorded([
      [/GetApiKeyInfo/, json(fx("kraken-keyinfo-read.json"))],
      [/AssetPairs/, json(fx("kraken-assetpairs.json"))],
      [/TradesHistory/, json(fx("kraken-trades.json"))],
    ]);
    const c = kraken.credentials({ apiKey: "A".repeat(56), secret: KRAKEN_DOC_SECRET });
    await kraken.check(c, ctx(fetch));
    const r = await kraken.read(c, RANGE, ctx(fetch), {});
    const hist = seen.find((s) => s.url.endsWith("/TradesHistory"))!;
    expect(hist.method).toBe("POST");
    expect(hist.headers["api-key"]).toBe("A".repeat(56));
    expect(hist.headers["api-sign"]).toMatch(/^[A-Za-z0-9+/]{86}==$/);
    expect(hist.body).toMatch(/^nonce=\d+&type=all&start=\d+&end=\d+&limit=100&with_cursor=true$/);
    expect(r.account).toBe("AA12 N84G TEST KEY0");
    expect(r.fills!.map((f) => f.symbol)).toContain("XBT/USD");
    const { pnl } = await paired(r);
    expect(pnl).toEqual([18.78, -53.95]);
  });
});

describe("Binance", () => {
  const c = binance.credentials({ apiKey: "k".repeat(64), secret: "s".repeat(64) });

  it("refuses a key with any power beyond reading, and Binance.US outright", async () => {
    expect(() => judgeRestrictions(JSON.parse(fx("binance-restrictions-trade.json")))).toThrow(/withdraw money, trade/);
    expect(() => judgeRestrictions({ enableReading: true, enableSomethingNew: true })).toThrow(/do more than read/);
    expect(() => judgeRestrictions({ enableReading: false })).toThrow(/cannot read/);
    expect(() => judgeRestrictions(JSON.parse(fx("binance-restrictions-read.json")))).not.toThrow();
    expect(() => binanceUs.credentials({})).toThrow(/Binance.US has no way/);
  });

  it("signs the query with HMAC-SHA256 and pages each market from its first trade", async () => {
    const { fetch, seen } = recorded([
      [/apiRestrictions/, json(fx("binance-restrictions-read.json"))],
      [/\/api\/v3\/account/, json(fx("binance-account.json"))],
      [/myTrades/, json(fx("binance-mytrades-btcusdt.json"))],
    ]);
    await binance.check(c, ctx(fetch));
    const r = await binance.read(c, RANGE, ctx(fetch), { symbols: ["BTCUSDT"] });
    const q = new URL(seen.find((s) => s.url.includes("myTrades"))!.url).searchParams;
    expect(q.get("symbol")).toBe("BTCUSDT");
    expect(q.get("fromId")).toBe("0");
    expect(q.get("signature")).toMatch(/^[0-9a-f]{64}$/);
    expect(seen[0].headers["x-mbx-apikey"]).toBe("k".repeat(64));
    expect(r.account).toBe("354937868");
    expect(r.notes[0]).toMatch(/BNB/);
    const { pnl } = await paired(r);
    expect(pnl).toEqual([95.9, -40.82]);
  });

  it("says plainly when Binance.com will not answer from where the server is", async () => {
    const { fetch } = recorded([[/apiRestrictions/, json({ code: 0, msg: "Service unavailable from a restricted location" }, 451)]]);
    await expect(binance.check(c, ctx(fetch))).rejects.toThrow(/does not answer from the country/);
  });
});

describe("Bybit", () => {
  const c = bybit.credentials({ apiKey: "XXXXXXXXXXXXXXXXXX", secret: "YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY" });

  it("takes only keys Bybit calls read-only, and never one that can withdraw", () => {
    expect(() => judgeKey(JSON.parse(fx("bybit-query-api-write.json")).result)).toThrow(/Read and Write/);
    expect(() => judgeKey({ readOnly: 1, permissions: { Wallet: ["Withdraw"] } })).toThrow(/withdraw money/);
    expect(() => judgeKey(JSON.parse(fx("bybit-query-api-read.json")).result)).not.toThrow();
  });

  it("walks the range a week at a time for spot and contracts, pairs each apart, and skips funding rows", async () => {
    const { fetch, seen } = recorded([
      [/query-api/, json(fx("bybit-query-api-read.json"))],
      [/execution\/list\?category=spot&startTime=1767225600000/, json(fx("bybit-exec-spot.json"))],
      [/execution\/list\?category=linear&startTime=1767225600000/, json(fx("bybit-exec-linear.json"))],
      [/execution\/list/, json(fx("bybit-exec-empty.json"))],
    ]);
    const r = await bybit.read(c, RANGE, ctx(fetch), {});
    const calls = seen.filter((s) => s.url.includes("execution/list"));
    expect(calls).toHaveLength(10); // 5 weeks in January, two categories
    const h = calls[0].headers;
    expect(h["x-bapi-sign"]).toMatch(/^[0-9a-f]{64}$/);
    expect(h["x-bapi-recv-window"]).toBe("10000");
    expect(r.account).toBe("24617703");
    const { pnl } = await paired(r);
    expect(pnl.sort((a, b) => a - b)).toEqual([94.1, 95.9]);
  });
});
