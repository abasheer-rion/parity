// Who may call what, how often, and from where, for the public API (DEC-0071). Pure
// functions and one small in-memory limiter, shared by the Pages Function, the keys page
// and the tests.

export const SCOPES = ["read:strategies", "read:markets", "read:verify", "write:verify"] as const;
export type Scope = (typeof SCOPES)[number];

export const SCOPE_TEXT: Record<Scope, string> = {
  "read:strategies": "Tested strategies, their 11 test results and the strategy search leaderboard",
  "read:markets": "Market series, the market snapshot and news impact",
  "read:verify": "Verify's list of checks and how each one is judged",
  "write:verify": "Send numbers to Verify and get a check back (nothing is stored)",
};

export const isScope = (s: unknown): s is Scope => typeof s === "string" && (SCOPES as readonly string[]).includes(s);

export const EXPIRY_DAYS = [30, 90, 180, 365] as const;
export const DEFAULT_EXPIRY_DAYS = 90;
/** Rotation keeps the old key working for this long, at most a week. */
export const OVERLAP_HOURS = [0, 1, 24, 168] as const;
export const MAX_ACTIVE_KEYS = 10;
export const MAX_ALLOWLIST = 20;

/** Requests a minute and a day for each plan. The plan comes from the person's entitlements
 *  (payment_entitlements, #82): api_access means API Starter, white_label means Platform. */
export const LIMITS = {
  free: { minute: 30, day: 1_000 },
  api_starter: { minute: 300, day: 20_000 },
  platform: { minute: 1_200, day: 200_000 },
} as const;
export type ApiPlan = keyof typeof LIMITS;
export const planOf = (p: unknown): ApiPlan => (p === "api_starter" || p === "platform" ? p : "free");

/** Requests in the last minute per key, counted in this worker. Cloudflare runs many workers,
 *  so this is a ceiling per worker; the daily quota is counted in the database. */
export class MinuteLimiter {
  private hits = new Map<string, number[]>();
  constructor(private now: () => number = Date.now) {}
  /** Hits in the last minute, without adding one. */
  count(id: string): number {
    const t = this.now();
    return (this.hits.get(id) ?? []).filter((x) => t - x < 60_000).length;
  }
  take(id: string, limit: number): { ok: boolean; remaining: number; reset: number } {
    const t = this.now();
    const recent = (this.hits.get(id) ?? []).filter((x) => t - x < 60_000);
    const reset = recent.length ? Math.max(1, Math.ceil((60_000 - (t - recent[0])) / 1000)) : 60;
    if (recent.length >= limit) {
      this.hits.set(id, recent);
      return { ok: false, remaining: 0, reset };
    }
    recent.push(t);
    this.hits.set(id, recent);
    if (this.hits.size > 5_000) this.hits.clear();
    return { ok: true, remaining: limit - recent.length, reset };
  }
}

// ---------------------------------------------------------------- IP allowlists

function v4(ip: string): bigint | null {
  const p = ip.split(".");
  if (p.length !== 4) return null;
  let n = 0n;
  for (const s of p) {
    if (!/^\d{1,3}$/.test(s) || Number(s) > 255) return null;
    n = (n << 8n) | BigInt(Number(s));
  }
  return n;
}

function v6(ip: string): bigint | null {
  if (!/^[0-9a-fA-F:.]+$/.test(ip) || ip.split("::").length > 2) return null;
  // An IPv4 tail ("::ffff:192.0.2.1") stands in for the last two groups.
  const cut = ip.lastIndexOf(":");
  const tail4 = ip.includes(".") ? ip.slice(cut + 1) : null;
  const head = tail4 ? `${ip.slice(0, cut + 1)}0:0` : ip;
  let parts: string[];
  if (head.includes("::")) {
    const [a, b] = head.split("::");
    const left = a ? a.split(":") : [], right = b ? b.split(":") : [];
    const fill = 8 - left.length - right.length;
    if (fill < 1) return null;
    parts = [...left, ...Array<string>(fill).fill("0"), ...right];
  } else parts = head.split(":");
  if (parts.length !== 8) return null;
  let n = 0n;
  for (const s of parts) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(s)) return null;
    n = (n << 16n) | BigInt(parseInt(s, 16));
  }
  if (tail4) {
    const t = v4(tail4);
    if (t === null) return null;
    n = (n & ~0xffffffffn) | t;
  }
  return n;
}

/** The address as a number and its family, or null when it is not an IP address. */
export function parseIp(ip: string): { n: bigint; bits: 32 | 128 } | null {
  const a = v4(ip);
  if (a !== null) return { n: a, bits: 32 };
  const b = v6(ip);
  return b === null ? null : { n: b, bits: 128 };
}

/** A CIDR block ("203.0.113.0/24", "2001:db8::/32") or a single address, or null. */
export function parseCidr(text: string): { n: bigint; bits: 32 | 128; len: number } | null {
  const [addr, len, extra] = text.trim().split("/");
  if (extra !== undefined) return null;
  const ip = parseIp(addr);
  if (!ip) return null;
  const l = len === undefined ? ip.bits : /^\d{1,3}$/.test(len) ? Number(len) : -1;
  if (l < 0 || l > ip.bits) return null;
  return { ...ip, len: l };
}

export function ipAllowed(ip: string | null, allowlist: string[] | null | undefined): boolean {
  if (!allowlist || allowlist.length === 0) return true;
  const a = ip ? parseIp(ip) : null;
  if (!a) return false;
  return allowlist.some((c) => {
    const b = parseCidr(c);
    if (!b || b.bits !== a.bits) return false;
    const shift = BigInt(b.bits - b.len);
    return a.n >> shift === b.n >> shift;
  });
}
