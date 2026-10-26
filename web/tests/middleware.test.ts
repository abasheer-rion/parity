// The Cloudflare middleware treats /app/, /research/ and /sim/ the same way, and keeps
// the sign-in pages reachable on the sim host. jose is mocked, so no keys are fetched.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const verify = vi.fn();
vi.mock("jose", () => ({
  createRemoteJWKSet: () => ({}),
  jwtVerify: (...args: unknown[]) => verify(...args),
}));

const { accessToken, bearerToken, cacheFor, onRequest } = await import("../functions/_middleware");

const COOKIE = "sb-ttqvpxvctnomfbeoqbbs-auth-token";
const session = (token = "good.jwt.token") => `${COOKIE}=${encodeURIComponent(JSON.stringify({ access_token: token }))}`;

function run(url: string, cookie?: string) {
  const request = new Request(url, { headers: cookie ? { Cookie: cookie } : {} });
  const next = vi.fn(async (input?: Request) => new Response(`served ${input ? new URL(input.url).pathname : new URL(url).pathname}`, { status: 200 }));
  return { promise: onRequest({ request, next }), next };
}

beforeEach(() => {
  verify.mockReset();
  verify.mockImplementation(async (token: string) => {
    if (token !== "good.jwt.token") throw new Error("bad token");
    return { payload: { sub: "user-1", role: "authenticated" } };
  });
});

describe("signed out", () => {
  it.each(["/app/", "/research/", "/sim/", "/trade/", "/academy/", "/lab/"])("%s sends you to log in and back", async (path) => {
    const res = await run(`https://paritytrading.app${path}`).promise;
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(`/login/?next=${encodeURIComponent(path)}`);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("keeps the query string in next", async () => {
    const res = await run("https://paritytrading.app/research/?x=1").promise;
    expect(res.headers.get("Location")).toBe("/login/?next=%2Fresearch%2F%3Fx%3D1");
  });

  it("answers 401 for research data", async () => {
    const res = await run("https://paritytrading.app/data/latest.json").promise;
    expect(res.status).toBe(401);
  });

  it("serves the public pages without a check", async () => {
    for (const path of ["/", "/login/", "/legal/privacy/"]) {
      const { promise, next } = run(`https://paritytrading.app${path}`);
      expect((await promise).status).toBe(200);
      expect(next).toHaveBeenCalled();
    }
  });

  it("refuses a forged or expired token", async () => {
    const res = await run("https://paritytrading.app/app/", session("forged")).promise;
    expect(res.status).toBe(302);
  });
});

describe("signed in", () => {
  it.each(["/app/", "/research/", "/sim/", "/trade/", "/academy/", "/lab/", "/data/latest.json"])("%s is served privately", async (path) => {
    const res = await run(`https://paritytrading.app${path}`, session()).promise;
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-cache");
    expect(res.headers.get("Vary")).toContain("Cookie");
  });
});

describe("a missing app path (DEC-0055)", () => {
  function missing(url: string, cookie?: string) {
    const request = new Request(url, { headers: cookie ? { Cookie: cookie } : {} });
    const next = vi.fn(async () => new Response("<title>Page not found</title>", { status: 404 }));
    return onRequest({ request, next });
  }

  it("opens the app at the same hash route when signed in", async () => {
    for (const [path, to] of [["/app/no-such-page-xyz", "/app/#/no-such-page-xyz"], ["/research/docs?x=1", "/research/#/docs?x=1"], ["/trade/junk/", "/trade/#/junk"]]) {
      const res = await missing(`https://paritytrading.app${path}`, session());
      expect(res.status, path).toBe(302);
      expect(res.headers.get("Location"), path).toBe(to);
    }
  });

  it("keeps the 404 for a missing file or asset", async () => {
    for (const path of ["/app/assets/gone-123.js", "/sim/missing.png", "/data/nothing.json"]) {
      const res = await missing(`https://paritytrading.app${path}`, session());
      expect(res.status, path).toBe(404);
    }
  });

  it("still asks a signed-out visitor to log in first", async () => {
    const res = await missing("https://paritytrading.app/app/no-such-page-xyz");
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(`/login/?next=${encodeURIComponent("/app/no-such-page-xyz")}`);
  });

  it("passes the 404 page through for public paths", async () => {
    const res = await missing("https://paritytrading.app/no-such-page-xyz/");
    expect(res.status).toBe(404);
  });
});

describe("built files (REF-0024)", () => {
  it.each(["/app/assets/main-P7fw5Tdc.js", "/academy/assets/academy-Iv1O6b4D.js", "/sim/assets/sim-Dglsj3qO.css", "/app/assets/_virtual_parity-docs-BLjKN8uG.js"])("%s is kept a year when signed in", async (path) => {
    const res = await run(`https://paritytrading.app${path}`, session()).promise;
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=31536000, immutable");
  });

  it("answers a plain 401 for a built file without a session, never the log-in page", async () => {
    const res = await run("https://academy.paritytrading.app/academy/assets/academy-Iv1O6b4D.js", session("expired")).promise;
    expect(res.status).toBe(401);
    expect(res.headers.get("Location")).toBeNull();
  });

  it("asks again for pages, data and files without a hash", () => {
    expect(cacheFor("/app/")).toBe("private, no-cache");
    expect(cacheFor("/data/latest.lite.json")).toBe("private, no-cache");
    expect(cacheFor("/trade/assets/x.js")).toBe("private, no-cache");
    expect(cacheFor("/app/assets/main-P7fw5Tdc.js", 404)).toBe("private, no-cache");
  });
});

describe("the sim host", () => {
  it("opens Sim World at / when signed in", async () => {
    const res = await run("https://sim.paritytrading.app/", session()).promise;
    expect(await res.text()).toBe("served /sim/");
  });

  it("sends signed-out visitors to its own log-in page, coming back to Sim World", async () => {
    const res = await run("https://sim.paritytrading.app/").promise;
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login/?next=%2Fsim%2F");
  });

  it("keeps the sign-in pages and assets public", async () => {
    for (const path of ["/login/", "/signup/", "/reset/", "/verify/", "/assets/x.js", "/brand/logo.svg"]) {
      const res = await run(`https://sim.paritytrading.app${path}`).promise;
      expect(res.status).toBe(200);
    }
  });

  it("sends the product and research apps to the main address", async () => {
    const res = await run("https://sim.paritytrading.app/research/?x=1").promise;
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://paritytrading.app/research/?x=1");
  });

  it("on the old domain, sends them to the old main address until the redirects take over (DEC-0067)", async () => {
    const res = await run("https://sim.endyland.com/research/?x=1").promise;
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://parity.endyland.com/research/?x=1");
  });
});

describe("the trade host", () => {
  it("opens Parity Trade at / when signed in", async () => {
    const res = await run("https://trade.paritytrading.app/", session()).promise;
    expect(await res.text()).toBe("served /trade/");
    expect(res.headers.get("Cache-Control")).toBe("private, no-cache");
  });

  it("sends signed-out visitors to its own log-in page, coming back to Parity Trade", async () => {
    const res = await run("https://trade.paritytrading.app/").promise;
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login/?next=%2Ftrade%2F");
  });

  it("keeps the sign-in pages and assets public", async () => {
    for (const path of ["/login/", "/signup/", "/reset/", "/verify/", "/assets/x.js", "/brand/logo.svg"]) {
      const res = await run(`https://trade.paritytrading.app${path}`).promise;
      expect(res.status).toBe(200);
    }
  });

  it("protects its own built files", async () => {
    const res = await run("https://trade.paritytrading.app/trade/assets/x.js").promise;
    expect(res.status).toBe(302);
  });

  it("sends the other apps to the main address", async () => {
    for (const path of ["/app/", "/research/?x=1", "/sim/"]) {
      const res = await run(`https://trade.paritytrading.app${path}`).promise;
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe(`https://paritytrading.app${path}`);
    }
  });

  it("the sim host sends /trade/ to the main address too", async () => {
    const res = await run("https://sim.paritytrading.app/trade/").promise;
    expect(res.headers.get("Location")).toBe("https://paritytrading.app/trade/");
  });
});

describe("the academy host", () => {
  it("opens Parity Academy at / when signed in", async () => {
    const res = await run("https://academy.paritytrading.app/", session()).promise;
    expect(await res.text()).toBe("served /academy/");
    expect(res.headers.get("Cache-Control")).toBe("private, no-cache");
  });

  it("sends signed-out visitors to its own log-in page, coming back to Parity Academy", async () => {
    const res = await run("https://academy.paritytrading.app/").promise;
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login/?next=%2Facademy%2F");
  });

  it("keeps the sign-in pages and assets public", async () => {
    for (const path of ["/login/", "/signup/", "/reset/", "/verify/", "/assets/x.js", "/brand/logo.svg"]) {
      const res = await run(`https://academy.paritytrading.app${path}`).promise;
      expect(res.status).toBe(200);
    }
  });

  it("protects its own built files", async () => {
    const res = await run("https://academy.paritytrading.app/academy/assets/x.js").promise;
    expect(res.status).toBe(302);
  });

  it("sends the other apps to the main address", async () => {
    for (const path of ["/app/", "/research/?x=1", "/sim/", "/trade/"]) {
      const res = await run(`https://academy.paritytrading.app${path}`).promise;
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe(`https://paritytrading.app${path}`);
    }
  });

  it("the trade host sends /academy/ to the main address too", async () => {
    const res = await run("https://trade.paritytrading.app/academy/").promise;
    expect(res.headers.get("Location")).toBe("https://paritytrading.app/academy/");
  });

  it("leaves the public course pages public", async () => {
    const res = await run("https://paritytrading.app/learn/academy/reading-a-backtest/").promise;
    expect(res.status).toBe(200);
  });
});

describe("the lab host", () => {
  it("opens Parity Workbench at / when signed in", async () => {
    const res = await run("https://lab.paritytrading.app/", session()).promise;
    expect(await res.text()).toBe("served /lab/");
    expect(res.headers.get("Cache-Control")).toBe("private, no-cache");
  });

  it("sends signed-out visitors to its own log-in page, coming back to Parity Workbench", async () => {
    const res = await run("https://lab.paritytrading.app/").promise;
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login/?next=%2Flab%2F");
  });

  it("keeps the sign-in pages and assets public", async () => {
    for (const path of ["/login/", "/signup/", "/reset/", "/verify/", "/assets/x.js", "/brand/logo.svg"]) {
      const res = await run(`https://lab.paritytrading.app${path}`).promise;
      expect(res.status).toBe(200);
    }
  });

  it("protects its own built files", async () => {
    const res = await run("https://lab.paritytrading.app/lab/assets/x.js").promise;
    expect(res.status).toBe(302);
  });

  it("sends the other apps to the main address", async () => {
    for (const path of ["/app/", "/research/?x=1", "/sim/", "/trade/", "/academy/"]) {
      const res = await run(`https://lab.paritytrading.app${path}`).promise;
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe(`https://paritytrading.app${path}`);
    }
  });

  it("the academy host sends /lab/ to the main address too", async () => {
    const res = await run("https://academy.paritytrading.app/lab/").promise;
    expect(res.headers.get("Location")).toBe("https://paritytrading.app/lab/");
  });

  it("leaves the public Edge Lab page public", async () => {
    const res = await run("https://paritytrading.app/learn/edge-lab/").promise;
    expect(res.status).toBe(200);
  });
});

describe("accessToken", () => {
  it("reads a plain, a split and a base64 cookie", () => {
    expect(accessToken(session("abc"))).toBe("abc");
    const json = JSON.stringify({ access_token: "split-token" });
    expect(accessToken(`${COOKIE}.0=${encodeURIComponent(json.slice(0, 10))}; ${COOKIE}.1=${encodeURIComponent(json.slice(10))}`)).toBe("split-token");
    const b64 = Buffer.from(JSON.stringify({ access_token: "b64-token" })).toString("base64url");
    expect(accessToken(`other=1; ${COOKIE}=base64-${b64}`)).toBe("b64-token");
  });

  it("returns null for missing or damaged cookies", () => {
    expect(accessToken("")).toBeNull();
    expect(accessToken(`${COOKIE}=not-json`)).toBeNull();
    expect(accessToken(`${COOKIE}=${encodeURIComponent(JSON.stringify({ access_token: 5 }))}`)).toBeNull();
  });
});

describe("bearer token (desktop app, DEC-0041)", () => {
  const withBearer = (url: string, auth: string) => {
    const request = new Request(url, { headers: { Authorization: auth } });
    const next = vi.fn(async () => new Response("served", { status: 200 }));
    return { promise: onRequest({ request, next }), next };
  };

  it("serves research data for a valid bearer token", async () => {
    const { promise, next } = withBearer("https://paritytrading.app/data/latest.json", "Bearer good.jwt.token");
    const res = await promise;
    expect(res.status).toBe(200);
    expect(next).toHaveBeenCalled();
    expect(res.headers.get("Cache-Control")).toBe("private, no-cache");
    expect(res.headers.get("Vary")).toContain("Authorization");
  });

  it("refuses a forged bearer token", async () => {
    const res = await withBearer("https://paritytrading.app/data/latest.json", "Bearer forged").promise;
    expect(res.status).toBe(401);
  });

  it("reads only a well formed header", () => {
    expect(bearerToken("Bearer a.b.c")).toBe("a.b.c");
    expect(bearerToken("  Bearer   a.b.c ")).toBe("a.b.c");
    expect(bearerToken("Basic a.b.c")).toBeNull();
    expect(bearerToken("Bearer a b")).toBeNull();
    expect(bearerToken(null)).toBeNull();
  });
});
