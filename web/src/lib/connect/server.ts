// /api/connect: read-only broker connections (DEC-0091). The Pages Function in
// functions/api/connect/[[path]].ts wires in the environment; everything else is here, so
// the tests and the E2E suite run exactly this code against recorded venue answers.
//
//   GET  status            whether connections are on here and what is set up (no sign-in)
//   GET  keys              the public keys that check a broker-connected badge (always on)
//   POST fetch             read once: check the credential can only read, fetch the trades,
//                          run Verify's checks, sign the result, drop the credential. With
//                          keep: true, the credential is also stored sealed (vault.ts).
//   POST sync              the same for a kept connection, by its id
//   POST alpaca/start      the address that sends the person to Alpaca's sign-in
//   GET  alpaca/callback   where Alpaca sends them back; passes the one-time code to the page
//
// Rules: the switch (BROKER_CONNECT, and the build's flag) must be on, except for keys; only
// Parity's own pages may call it (Origin), only a signed-in person (their Supabase session,
// not a connected AI app); 30 calls a minute per address here and the database's 10 reads an
// hour per person; bodies up to 20 KB; 25 seconds per read. A credential is never logged,
// never put in an error, never returned, and kept only sealed and only when asked.
import type { McpCaller } from "../mcp/auth";
import type { PriceBook } from "../verify/prices";
import { jwks, oldKeys, publicKeyOf, seedFrom, type PublicKey } from "./attest";
import { fromB64url, fromUtf8, hkdf, hmac, randomBytes, sameText, sha256Hex, toB64url, utf8 } from "./bytes";
import { buildRecord } from "./record";
import type { ConnectStore } from "./store";
import { ConnectError, isoDay, isVenue, type Connector, type Range, type VenueCtx, type VenueId } from "./types";
import { vaultFrom } from "./vault";
import { VENUES } from "./venues";
import { alpaca, authorizeUrl, exchangeCode } from "./venues/alpaca";
import { binance, binanceUs } from "./venues/binance";
import { bybit } from "./venues/bybit";
import { coinbase } from "./venues/coinbase";
import { ibkr } from "./venues/ibkr";
import { kraken } from "./venues/kraken";

export const CONNECTORS: Record<VenueId, Connector<unknown>> = {
  ibkr, alpaca, coinbase, kraken, binance, binance_us: binanceUs, bybit,
} as Record<VenueId, Connector<unknown>>;

export interface ConnectEnv {
  /** "off" switches /api/connect off whatever the build says; "on" switches it on. */
  BROKER_CONNECT?: string;
  /** Ed25519 seed, 32 bytes as base64url: signs broker-connected records. */
  BROKER_RECORD_SIGNING_KEY?: string;
  /** Public keys of earlier signing keys, comma separated, still trusted for old badges. */
  BROKER_RECORD_OLD_PUBLIC_KEYS?: string;
  /** 32 bytes as base64url: seals kept credentials. Without it, "keep in sync" is off. */
  BROKER_CREDENTIAL_KEY?: string;
  ALPACA_OAUTH_CLIENT_ID?: string;
  ALPACA_OAUTH_CLIENT_SECRET?: string;
}

export interface ConnectDeps {
  env: ConnectEnv;
  /** The build's switch (VITE_VERIFY_CONNECTIONS), read from the site's own files. */
  buildFlag(): Promise<boolean>;
  verify(token: string): Promise<McpCaller | null>;
  store: ConnectStore;
  /** fetch for the venues; tests pass recorded answers. */
  venueFetch: typeof fetch;
  prices(): Promise<PriceBook | null>;
  siteDomain: string;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  /** One JSON line per request. Never a credential, a token or a venue's raw reply. */
  log?: (line: Record<string, unknown>) => void;
}

const HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
const reply = (status: number, body: unknown, extra: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { ...HEADERS, ...extra } });
const fail = (e: ConnectError) => reply(e.status, { error: e.message, code: e.code });
const READ_MS = 25_000;
const MAX_BODY = 20_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when connections are on: the environment's switch wins, then the build's. */
export async function enabled(deps: Pick<ConnectDeps, "env" | "buildFlag">): Promise<boolean> {
  if (deps.env.BROKER_CONNECT === "off") return false;
  if (deps.env.BROKER_CONNECT === "on") return true;
  try { return await deps.buildFlag(); } catch { return false; }
}

/** Only Parity's own pages: the site, its subdomains, its Cloudflare previews and a local build. */
export function sameSite(origin: string | null, siteDomain: string): boolean {
  if (!origin) return false;
  let u: URL;
  try { u = new URL(origin); } catch { return false; }
  const h = u.hostname;
  if (u.protocol === "http:") return h === "localhost" || h === "127.0.0.1";
  if (u.protocol !== "https:") return false;
  return h === siteDomain || h.endsWith(`.${siteDomain}`) || h === "parity.endyland.com" || h === "parity-research.pages.dev" || h.endsWith(".parity-research.pages.dev");
}

const hits = new Map<string, { at: number; n: number }>();
/** 30 calls a minute per address, in this worker. The database's per-person limit is the real one. */
export function burst(ip: string, now: number): boolean {
  const h = hits.get(ip);
  if (!h || now - h.at > 60_000) { if (hits.size > 5_000) hits.clear(); hits.set(ip, { at: now, n: 1 }); return true; }
  h.n++;
  return h.n <= 30;
}

async function keysOf(env: ConnectEnv): Promise<PublicKey[]> {
  const seed = seedFrom(env.BROKER_RECORD_SIGNING_KEY);
  return [...(seed ? [await publicKeyOf(seed)] : []), ...(await oldKeys(env.BROKER_RECORD_OLD_PUBLIC_KEYS))];
}

// ------------------------------------------------------------------- reading the request

export interface FetchBody {
  venue: VenueId;
  credentials: Record<string, unknown>;
  range: Range;
  tries: number;
  balance: number | null;
  symbols: string[];
  keep: boolean;
  label: string;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function readRange(b: Record<string, unknown>, venue: VenueId, now: number): Range {
  const from = typeof b.from === "string" ? b.from : "";
  const to = typeof b.to === "string" ? b.to : "";
  if (!DAY.test(from) || !DAY.test(to) || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) throw new ConnectError(400, "Pick a start and an end date.");
  if (from > to) throw new ConnectError(400, "The start date is after the end date.");
  if (from < "2000-01-01") throw new ConnectError(400, "Pick a start date in 2000 or later.");
  if (to > isoDay(now)) throw new ConnectError(400, "The end date is in the future.");
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1;
  const max = VENUES[venue].maxDays;
  if (days > max) throw new ConnectError(400, `${VENUES[venue].name} can be read at most ${max} days at a time. Pick a shorter range.`);
  return { from, to };
}

export function readOptions(b: Record<string, unknown>) {
  const tries = b.tries == null ? 1 : Number(b.tries);
  if (!Number.isInteger(tries) || tries < 1 || tries > 10_000_000) throw new ConnectError(400, "Tries must be a whole number from 1 to 10,000,000.");
  const balance = b.balance == null || b.balance === "" ? null : Number(b.balance);
  if (balance != null && (!Number.isFinite(balance) || balance <= 0 || balance > 1e12)) throw new ConnectError(400, "The starting balance must be a positive number, or left empty.");
  const symbols = Array.isArray(b.symbols) ? [...new Set(b.symbols.filter((s): s is string => typeof s === "string").map((s) => s.trim().toUpperCase()).filter(Boolean))] : [];
  if (symbols.length > 20) throw new ConnectError(400, "Name at most 20 markets.");
  if (symbols.some((s) => !/^[A-Z0-9]{4,20}$/.test(s))) throw new ConnectError(400, "Markets are written like BTCUSDT, letters and digits only.");
  return { tries, balance, symbols };
}

async function body(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (text.length > MAX_BODY) throw new ConnectError(413, "That is too much to send. A key is much shorter.");
  try {
    const v = JSON.parse(text) as unknown;
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch { /* below */ }
  throw new ConnectError(400, "Send JSON.");
}

// ------------------------------------------------------------------- Alpaca's sign-in state

async function stateKey(seed: Uint8Array) { return hkdf(seed, "parity alpaca oauth state v1"); }

/** A short-lived, signed note of who started the sign-in and for which account. */
export async function makeState(seed: Uint8Array, userId: string, env: "live" | "paper", now: number): Promise<string> {
  const n = toB64url(randomBytes(12));
  const payload = toB64url(utf8(JSON.stringify({ u: await sha256Hex(`${userId}:${n}`), n, e: env, x: Math.floor(now / 1000) + 600 })));
  return `${payload}.${toB64url(await hmac("SHA-256", await stateKey(seed), payload))}`;
}

export async function readState(seed: Uint8Array, state: string, userId: string, now: number): Promise<"live" | "paper"> {
  const [payload, sig] = state.split(".");
  const bad = new ConnectError(400, "The Alpaca sign-in could not be matched to you, or took more than 10 minutes. Start again.");
  if (!payload || !sig || state.length > 600) throw bad;
  if (!sameText(sig, toB64url(await hmac("SHA-256", await stateKey(seed), payload)))) throw bad;
  let p: { u?: string; n?: string; e?: string; x?: number };
  try { p = JSON.parse(fromUtf8(fromB64url(payload))); } catch { throw bad; }
  if (!p.n || p.u !== (await sha256Hex(`${userId}:${p.n}`)) || !(typeof p.x === "number" && p.x * 1000 > now)) throw bad;
  return p.e === "paper" ? "paper" : "live";
}

const callbackUrl = (request: Request) => `${new URL(request.url).origin}/api/connect/alpaca/callback`;

// ------------------------------------------------------------------- the handler

export async function handleConnect(request: Request, deps: ConnectDeps): Promise<Response> {
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const started = now();
  const url = new URL(request.url);
  const route = url.pathname.replace(/^\/api\/connect\/?/, "").replace(/\/+$/, "");
  const line: Record<string, unknown> = { msg: "connect", route, method: request.method };
  const done = (res: Response) => { deps.log?.({ ...line, status: res.status, ms: now() - started }); return res; };

  try {
    // The public keys stay up even when connections are switched off: published badges need them.
    if (route === "keys" && request.method === "GET") {
      return done(new Response(JSON.stringify(jwks(await keysOf(deps.env))), {
        headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600", "Access-Control-Allow-Origin": "*", "X-Content-Type-Options": "nosniff" },
      }));
    }
    if (!(await enabled(deps))) return done(reply(404, { error: "Not found", code: "off" }));
    const seed = seedFrom(deps.env.BROKER_RECORD_SIGNING_KEY);

    if (route === "status" && request.method === "GET") {
      return done(reply(200, {
        on: true, signing: !!seed, keep: !!(await vaultFrom(deps.env.BROKER_CREDENTIAL_KEY)),
        alpaca: !!(seed && deps.env.ALPACA_OAUTH_CLIENT_ID && deps.env.ALPACA_OAUTH_CLIENT_SECRET),
      }));
    }
    if (route === "alpaca/callback" && request.method === "GET") {
      // The code is single-use and only works with our client secret and a state signed for
      // the person who started; it goes to the page in the fragment, which is never sent to
      // a server or in a Referer.
      const code = url.searchParams.get("code") ?? "";
      const state = url.searchParams.get("state") ?? "";
      const frag = code && /^[A-Za-z0-9._~-]{4,512}$/.test(code) && /^[A-Za-z0-9._-]{10,600}$/.test(state)
        ? `code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`
        : `error=${url.searchParams.get("error") === "access_denied" ? "denied" : "failed"}`;
      return done(new Response(null, { status: 302, headers: { Location: `/verify/?connect=alpaca#${frag}`, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } }));
    }

    if (request.method !== "POST") return done(reply(405, { error: "POST only" }, { Allow: "POST" }));
    if (!sameSite(request.headers.get("Origin"), deps.siteDomain)) return done(reply(403, { error: "Not allowed from this site." }));
    const ip = request.headers.get("CF-Connecting-IP") ?? "local";
    if (!burst(ip, now())) return done(reply(429, { error: "Too many requests. Wait a minute.", code: "rate_limited" }));
    const token = request.headers.get("Authorization")?.match(/^Bearer\s+([A-Za-z0-9._~+/=-]+)$/)?.[1];
    const caller = token ? await deps.verify(token) : null;
    if (!caller || !token) return done(reply(401, { error: "Sign in first.", code: "signed_out" }));
    if (caller.clientId) return done(reply(403, { error: "Connected apps cannot read from brokers.", code: "refused" }));
    if (!seed) return done(fail(new ConnectError(503, "Broker connections are not set up on this server yet.", "not_set_up")));
    const b = await body(request);

    if (route === "alpaca/start") {
      const cid = deps.env.ALPACA_OAUTH_CLIENT_ID;
      if (!cid || !deps.env.ALPACA_OAUTH_CLIENT_SECRET) throw new ConnectError(503, "Signing in with Alpaca is not set up on this server yet.", "not_set_up");
      const env = b.env === "paper" ? "paper" : "live";
      return done(reply(200, { url: authorizeUrl(cid, callbackUrl(request), await makeState(seed, caller.userId, env, now()), env) }));
    }

    if (route === "fetch" || route === "sync") {
      const vault = await vaultFrom(deps.env.BROKER_CREDENTIAL_KEY);
      let venue: VenueId;
      let raw: Record<string, unknown>;
      let connection: string | null = null;
      let keep = false;
      let label = "";
      if (route === "sync") {
        connection = typeof b.connection === "string" && UUID.test(b.connection) ? b.connection : null;
        if (!connection) throw new ConnectError(400, "Say which connection to read.");
        if (!vault) throw new ConnectError(503, "Kept connections are not set up on this server.", "not_set_up");
        const kept = await deps.store.open(token, connection);
        if (!kept) throw new ConnectError(404, "That connection was not found or was revoked.");
        if (kept.key_id !== vault.keyId) throw new ConnectError(409, "This connection was saved under an older server key. Revoke it in Settings and connect again.", "not_set_up");
        const dk = await deps.store.dataKey(token);
        if (!dk || dk.key_id !== vault.keyId) throw new ConnectError(409, "This connection can no longer be opened. Revoke it in Settings and connect again.", "not_set_up");
        venue = kept.venue;
        try { raw = await vault.open<Record<string, unknown>>(dk.sealed, caller.userId, `${connection}:${venue}`, kept.sealed); } catch {
          throw new ConnectError(409, "This connection can no longer be opened. Revoke it in Settings and connect again.", "not_set_up");
        }
      } else {
        if (!isVenue(b.venue)) throw new ConnectError(400, "Pick a broker or exchange.");
        venue = b.venue;
        raw = b.credentials && typeof b.credentials === "object" ? b.credentials as Record<string, unknown> : {};
        keep = b.keep === true;
        label = typeof b.label === "string" ? b.label.trim().slice(0, 80) : "";
        if (keep && !vault) throw new ConnectError(503, "Keeping a connection in sync is not set up on this server yet. Untick it to read once.", "not_set_up");
      }
      line.venue = venue;
      const range = readRange(b, venue, now());
      const opts = readOptions(b);
      if ((venue === "binance" || venue === "binance_us") && !opts.symbols.length) throw new ConnectError(400, "Name the markets you traded, such as BTCUSDT.");

      await deps.store.begin(token, venue, connection);
      const ctx: VenueCtx = { fetch: deps.venueFetch, now, sleep, deadline: now() + READ_MS, requests: { n: 0 } };
      try {
        // Alpaca: a one-time code from its sign-in becomes a token here, on the server.
        if (venue === "alpaca" && route === "fetch") {
          const env = await readState(seed, typeof raw.state === "string" ? raw.state : "", caller.userId, now());
          const code = typeof raw.code === "string" ? raw.code : "";
          if (!/^[A-Za-z0-9._~-]{4,512}$/.test(code)) throw new ConnectError(400, "The Alpaca sign-in did not finish. Start again.");
          const accessToken = await exchangeCode(ctx, { code, clientId: deps.env.ALPACA_OAUTH_CLIENT_ID ?? "", clientSecret: deps.env.ALPACA_OAUTH_CLIENT_SECRET ?? "", redirectUri: callbackUrl(request) });
          raw = { accessToken, env };
        }
        const connector = CONNECTORS[venue];
        const creds = connector.credentials(raw);
        await connector.check(creds, ctx);
        const read = await connector.read(creds, range, ctx, { symbols: opts.symbols });
        const record = await buildRecord({ venue: read, venueId: venue, range, tries: opts.tries, balance: opts.balance, userId: caller.userId, seed, prices: await deps.prices().catch(() => null), now: now() });
        let kept: string | null = connection;
        if (keep && vault) {
          const id = crypto.randomUUID();
          let dk = await deps.store.dataKey(token);
          if (!dk || dk.key_id !== vault.keyId) dk = await deps.store.putDataKey(token, await vault.newDataKey(caller.userId), vault.keyId);
          const sealed = await vault.seal(dk.sealed, caller.userId, `${id}:${venue}`, raw);
          await deps.store.save(token, { id, venue, env: read.env, label: label || `${VENUES[venue].name} ${read.env === "paper" ? "paper" : ""}`.trim(), account: record.claims.account, sealed, keyId: vault.keyId });
          kept = id;
        }
        const detail = `${record.result.trades ?? 0} trades, ${range.from} to ${range.to}`;
        if (route === "sync" && connection) await deps.store.synced(token, connection, true, detail);
        else await deps.store.log(token, venue, "fetched", detail, kept);
        line.requests = ctx.requests.n;
        line.trades = record.result.trades;
        return done(reply(200, {
          record: { result: record.result, cards: record.cards, attestation: record.attestation, csv: record.csv },
          source: { venue, name: VENUES[venue].name, env: record.claims.env, account: record.claims.account, fetchedAt: record.claims.fetched_at, from: range.from, to: range.to },
          notes: record.notes,
          connection: kept,
        }));
      } catch (e) {
        const ce = e instanceof ConnectError ? e : new ConnectError(500, `Something went wrong reading from ${VENUES[venue].name}. Nothing was kept. Try again later.`, "venue_down");
        line.code = ce.code;
        line.requests = ctx.requests.n;
        if (!(e instanceof ConnectError)) line.error = e instanceof Error ? e.name : "unknown";
        try {
          if (route === "sync" && connection) await deps.store.synced(token, connection, false, ce.message);
          else await deps.store.log(token, venue, ce.code === "refused" ? "refused" : "failed", ce.message);
        } catch { /* the reply below matters more than the log row */ }
        return done(fail(ce));
      }
    }
    return done(reply(404, { error: "Not found" }));
  } catch (e) {
    if (e instanceof ConnectError) { line.code = e.code; return done(fail(e)); }
    line.error = e instanceof Error ? e.name : "unknown";
    return done(reply(500, { error: "Something went wrong. Nothing was kept. Try again later." }));
  }
}
