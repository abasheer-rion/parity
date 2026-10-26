// Team-only live data (DEC-0056): the server's team check, which sources are team only, the
// new wire messages (book, trades list, overview) and each venue's message parsing, from
// messages recorded off the real feeds on 25 Oct 2026. No network.
import { afterEach, describe, expect, it } from "vitest";
import { _forget, cookieToken, teamPass, tokenOf } from "../src/lib/live/teamGate";
import { isInternal, SOURCES } from "../src/lib/live/sources";
import { parseClient, parseServer } from "../src/lib/live/protocol";
import { allowed } from "../live/src/base";
import { kraken } from "../live/src/venues/kraken";
import { coinbase } from "../live/src/venues/coinbase";
import { gemini } from "../live/src/venues/gemini";
import { binanceus } from "../live/src/venues/binanceus";
import { alpaca, finnhub } from "../live/src/venues/stocks";

const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const jwt = (exp: number) => `${b64({ alg: "ES256" })}.${b64({ sub: "u1", exp })}.sig`;
const verifyOk = async (token: string) => ({ userId: "u1", email: null, clientId: null, token });
const verifyApp = async (token: string) => ({ userId: "u1", email: null, clientId: "app", token });
const rpc = (answer: unknown, status = 200) => (async () => new Response(JSON.stringify(answer), { status })) as unknown as typeof fetch;
const req = (headers: Record<string, string>) => new Request("https://trade.endyland.com/live/ws?src=kraken", { headers });

describe("team gate", () => {
  afterEach(() => _forget());
  const future = Math.floor(Date.now() / 1000) + 3600;

  it("finds the sign-in in the header, the sub-protocol or the session cookie", () => {
    expect(tokenOf(req({ Authorization: "Bearer abc.def.ghi" }))).toBe("abc.def.ghi");
    expect(tokenOf(req({ "Sec-WebSocket-Protocol": "parity-live, bearer.abc.def.ghi" }))).toBe("abc.def.ghi");
    const cookie = `sb-ttqvpxvctnomfbeoqbbs-auth-token=base64-${b64({ access_token: "c.d.e" })}`;
    expect(cookieToken(cookie)).toBe("c.d.e");
    expect(tokenOf(req({}))).toBeNull();
  });

  it("passes a team member until their sign-in expires", async () => {
    const t = jwt(future);
    const pass = await teamPass(req({ Authorization: `Bearer ${t}` }), rpc(true), verifyOk);
    expect(pass).toEqual({ userId: "u1", until: future * 1000 });
  });

  it("refuses people off the team, AI app tokens, expired sign-ins and database errors", async () => {
    expect(await teamPass(req({ Authorization: `Bearer ${jwt(future)}` }), rpc(false), verifyOk)).toBeNull();
    _forget();
    expect(await teamPass(req({ Authorization: `Bearer ${jwt(future)}` }), rpc(true), verifyApp)).toBeNull();
    expect(await teamPass(req({ Authorization: `Bearer ${jwt(1)}` }), rpc(true), verifyOk)).toBeNull();
    expect(await teamPass(req({ Authorization: `Bearer ${jwt(future)}` }), rpc({ message: "boom" }, 500), verifyOk)).toBeNull();
    expect(await teamPass(req({}), rpc(true), verifyOk)).toBeNull();
    expect(await teamPass(req({ Authorization: `Bearer ${jwt(future)}` }), rpc(true), async () => null)).toBeNull();
  });
});

describe("which sources are team only", () => {
  it("marks every venue whose terms allow internal use only, and nothing public", () => {
    const internal = SOURCES.filter((s) => s.licence === "internal").map((s) => s.id).sort();
    expect(internal).toEqual(["alpaca", "binanceus", "coinbase", "finnhub", "gemini", "hyperliquid", "kraken"]);
    expect(isInternal("coingecko")).toBe(false);
    for (const s of SOURCES.filter((x) => x.licence === "internal")) expect(s.basis, s.id).toBeTruthy();
  });

  it("keeps keyed sources off until every key is set, and honours the off switch", () => {
    expect(allowed("alpaca", {})).toBe(false);
    expect(allowed("alpaca", { ALPACA_KEY_ID: "k" })).toBe(false);
    expect(allowed("alpaca", { ALPACA_KEY_ID: "k", ALPACA_SECRET_KEY: "s" })).toBe(true);
    expect(allowed("finnhub", { FINNHUB_TOKEN: "t" })).toBe(true);
    expect(allowed("kraken", {})).toBe(true);
    expect(allowed("kraken", { LIVE_DENY: "gemini, kraken" })).toBe(false);
    expect(allowed("bitstamp", {})).toBe(false);
  });
});

describe("wire, book, trades and overview", () => {
  it("accepts book, trades and overview subscriptions", () => {
    expect(parseClient(JSON.stringify({ op: "sub", s: ["B:BTC-USD", "X:BTC-USD", "*", "BRK.B", "b:x"] }))).toEqual({ op: "sub", s: ["B:BTC-USD", "X:BTC-USD", "*", "BRK.B"] });
  });

  it("checks book, trades and overview messages", () => {
    expect(parseServer(JSON.stringify({ op: "b", s: "BTC-USD", b: [[1, 2], ["x", 1]], a: [[3, 4]], te: 1, tr: 2, ts: 3 }))).toEqual({ op: "b", s: "BTC-USD", b: [[1, 2]], a: [[3, 4]], te: 1, tr: 2, ts: 3 });
    expect(parseServer(JSON.stringify({ op: "x", s: "BTC-USD", d: [[1, 2, 3, 1], [1, "x", 3, 1]], ts: 5 }))).toEqual({ op: "x", s: "BTC-USD", d: [[1, 2, 3, 1]], ts: 5 });
    const r = parseServer(JSON.stringify({ op: "r", d: [["BTC-USD", 1, null, 5, 9], ["ETH-USD", "x", 1, 1, 1]], ts: 1, full: 1, sp: { "BTC-USD": [1, 2] }, every: 60000 }));
    expect(r).toEqual({ op: "r", d: [["BTC-USD", 1, null, 5, 9]], ts: 1, full: 1, sp: { "BTC-USD": [1, 2] }, every: 60000 });
    expect(parseServer(JSON.stringify({ op: "hello", src: "kraken", feed: "rt", ts: 1, max: 24, internal: true }))).toMatchObject({ internal: true });
  });
});

describe("venue messages", () => {
  it("Kraken: trades with the taker side, book snapshot and ticker rows", () => {
    const a = kraken.make({});
    expect(a.parse('{"channel":"trade","type":"update","data":[{"symbol":"BTC/USD","side":"buy","price":80603.3,"qty":0.001873,"ord_type":"limit","trade_id":1,"timestamp":"2026-10-25T18:09:59.298446Z"}]}').t)
      .toEqual([{ s: "BTC-USD", p: 80603.3, v: 0.001873, te: Date.parse("2026-10-25T18:09:59.298Z"), side: 1 }]);
    const b = a.parse('{"channel":"book","type":"snapshot","data":[{"symbol":"BTC/USD","bids":[{"price":80603.2,"qty":0.42}],"asks":[{"price":80603.3,"qty":1}],"timestamp":"2026-10-25T18:10:00.000Z"}]}').b!;
    expect(b[0]).toMatchObject({ s: "BTC-USD", snap: true, bids: [[80603.2, 0.42]], asks: [[80603.3, 1]] });
    const r = a.parse('{"channel":"ticker","type":"update","data":[{"symbol":"EUR/USD","last":1.16,"change_pct":0.12,"volume":1000,"vwap":1.15}]}').r!;
    expect(r[0]).toMatchObject({ s: "EUR-USD", p: 1.16, c: 0.12, v: 1150 });
    expect(a.subscribe(["BTC-USD"])).toEqual(['{"method":"subscribe","params":{"channel":"trade","symbol":["BTC/USD"]}}']);
  });

  it("Coinbase: the taker is the other side of the maker", () => {
    const a = coinbase.make({});
    const t = a.parse('{"type":"match","trade_id":1,"side":"sell","size":"0.0036478","price":"80601.64","product_id":"BTC-USD","sequence":1,"time":"2026-10-25T18:09:56.982016Z"}').t!;
    expect(t[0]).toMatchObject({ s: "BTC-USD", p: 80601.64, v: 0.0036478, side: 1 });
    const u = a.parse('{"type":"l2update","product_id":"BTC-USD","changes":[["sell","81715.01","0.00000000"],["buy","80562.06","0.01479008"]],"time":"2026-10-25T18:09:56.749496Z"}').b!;
    expect(u[0]).toMatchObject({ snap: false, asks: [[81715.01, 0]], bids: [[80562.06, 0.01479008]] });
    const r = a.parse('{"type":"ticker","product_id":"BTC-USD","price":"80605.14","open_24h":"80430.62","volume_24h":"10","time":"2026-10-25T18:09:51.116170Z"}').r!;
    expect(r[0]).toMatchObject({ s: "BTC-USD", p: 80605.14, o: 80430.62, v: 806051.4 });
  });

  it("Gemini: trades only for symbols a chart wants, and the first book message is the whole book", () => {
    const a = gemini.make({});
    expect(a.subscribe(["BTC-USD"])).toEqual(['{"type":"subscribe","subscriptions":[{"name":"l2","symbols":["BTCUSD"]}]}']);
    expect(a.parse('{"event_id":1,"price":"80617.12","quantity":"0.00006202","side":"buy","symbol":"BTCUSD","tid":2,"timestamp":1792951796861,"type":"trade"}').t).toEqual([{ s: "BTC-USD", p: 80617.12, v: 0.00006202, te: 1792951796861, side: 1 }]);
    // The book is wanted later: Gemini is asked again so the whole book comes first.
    expect(a.book!.subscribe(["BTC-USD"])).toHaveLength(2);
    expect(a.parse('{"changes":[["buy","80596.89","1.0"]],"symbol":"BTCUSD","type":"l2_updates"}').b![0].snap).toBe(true);
    expect(a.parse('{"changes":[["buy","80596.89","0.0"]],"symbol":"BTCUSD","type":"l2_updates"}').b![0].snap).toBe(false);
  });

  it("Binance.US: overview rows from the mini ticker once symbols are known", async () => {
    const a = binanceus.make({});
    expect(a.parse('{"stream":"!miniTicker@arr","data":[{"e":"24hrMiniTicker","E":1,"s":"ZECUSDT","c":"1226.92","o":"1163.88","h":"1","l":"1","v":"1","q":"582325.7994"}]}').r).toEqual([]);
  });

  it("Alpaca: waits for its sign-in, then reads trades; Finnhub reads trades", () => {
    const a = alpaca.make({ ALPACA_KEY_ID: "k", ALPACA_SECRET_KEY: "s" });
    expect(a.needsReady).toBe(true);
    expect(a.maxUpstream).toBe(30);
    expect(a.parse('[{"T":"success","msg":"authenticated"}]').ready).toBe(true);
    expect(a.parse('[{"T":"t","S":"AAPL","p":230.1,"s":100,"t":"2026-10-26T14:30:00.123456789Z"}]').t).toEqual([{ s: "AAPL", p: 230.1, v: 100, te: Date.parse("2026-10-26T14:30:00.123Z") }]);
    expect(a.parse('[{"T":"error","code":402,"msg":"auth failed"}]').fail).toBe("Alpaca 402 auth failed");
    expect(alpaca.make({ ALPACA_KEY_ID: "k", ALPACA_SECRET_KEY: "s", ALPACA_FEED: "sip" }).url).toContain("/v2/sip");
    const f = finnhub.make({ FINNHUB_TOKEN: "t" });
    expect(f.parse('{"type":"trade","data":[{"s":"AAPL","p":1.5,"t":5,"v":2}]}').t).toEqual([{ s: "AAPL", p: 1.5, v: 2, te: 5 }]);
  });
});
