// Shared helpers for the k6 load tests (REF-0025). Every test ramps in steps: each step is
// its own constant-rate scenario tagged step=<rate>, started when the one before ends, so the
// summary shows each step on its own and the run stops at the first step that breaks a limit:
//   p95 over 2 s, more than 2% errors, or (REST only) any sign the database is out of
//   connections. The step before the one that broke is the most it held.
//
// Safety, before anything is sent:
//   - BASE must be set, and the live site's own addresses are refused unless ALLOW_PROD=1
//     (only the light, read-only checks should ever use that).
//   - each script states how many requests it plans to send; when they run a Cloudflare
//     function (which count against the free plan's 100,000 a day for the whole account),
//     the run stops unless the plan fits BUDGET (default 8000).
import k6run from "k6/execution";

export const PROD = /(^|\.)(endyland\.com|paritytrading\.app)$/;

export function base() {
  const b = (__ENV.BASE || "").replace(/\/$/, "");
  if (!b) k6run.test.abort("Set BASE, for example BASE=https://<preview>.parity-research.pages.dev");
  const host = b.replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
  if (PROD.test(host) && __ENV.ALLOW_PROD !== "1") k6run.test.abort(`${host} is the live site. Use a preview, or ALLOW_PROD=1 for a light read-only check.`);
  return b;
}

/** Step rates from STEPS="10,20,40" (or the default). */
export function stepRates(def) {
  return (__ENV.STEPS || def).split(",").map((s) => Number(s.trim())).filter((n) => n > 0);
}

/**
 * One constant-arrival-rate scenario per step, back to back, plus per-step thresholds that
 * stop the whole run at the first broken limit.
 *   fn        name of the exported function each iteration runs
 *   rates     iterations per second, one per step
 *   seconds   how long each step lasts
 *   perIter   requests per iteration (for the budget)
 *   fnShare   share of those requests that run a Cloudflare function (0 to 1)
 */
export function stepped({ fn, rates, seconds, perIter = 1, fnShare = 0, extraThresholds = {} }) {
  const scenarios = {};
  const thresholds = { ...extraThresholds };
  let start = 0;
  let planned = 0;
  for (const r of rates) {
    scenarios[`step_${r}`] = {
      executor: "constant-arrival-rate",
      exec: fn,
      rate: r,
      timeUnit: "1s",
      duration: `${seconds}s`,
      startTime: `${start}s`,
      preAllocatedVUs: Math.max(10, Math.ceil(r * 1.5)),
      maxVUs: Math.max(50, r * 6),
      gracefulStop: "5s",
      tags: { step: String(r) },
    };
    thresholds[`http_req_duration{step:${r}}`] = [{ threshold: "p(95)<2000", abortOnFail: true, delayAbortEval: "10s" }];
    thresholds[`http_req_failed{step:${r}}`] = [{ threshold: "rate<0.02", abortOnFail: true, delayAbortEval: "10s" }];
    thresholds[`http_reqs{step:${r}}`] = ["count>=0"];
    start += seconds;
    planned += r * seconds * perIter;
  }
  const fnPlanned = Math.round(planned * fnShare);
  const budget = Number(__ENV.BUDGET || 8000);
  if (fnPlanned > budget) {
    throw new Error(`This run plans ${fnPlanned} function requests, over BUDGET=${budget}. Lower STEPS or STEP_S, or raise BUDGET knowingly.`);
  }
  if (__VU === 0) console.log(`plan: ${rates.length} steps of ${seconds}s (${rates.join(", ")} per second), about ${Math.round(planned)} requests, ${fnPlanned} of them run a function`);
  return { scenarios, thresholds, summaryTrendStats: ["avg", "med", "p(95)", "p(99)", "max"] };
}

function stat(m, k) {
  const v = m && m.values ? m.values[k] : undefined;
  return v === undefined ? null : Math.round(v * 100) / 100;
}

const broke = (m) => !!(m && m.thresholds && Object.values(m.thresholds).some((t) => !t.ok));

/** Per-endpoint numbers in the summary: a threshold that always passes makes k6 keep them. */
export function byName(names) {
  return Object.fromEntries(names.map((n) => [`http_req_duration{name:${n}}`, ["max>=0"]]));
}

/** A short table per step, written to load/results/<name>-<time>.json and printed. */
export function summarize(name, data) {
  const steps = [];
  for (const key of Object.keys(data.metrics)) {
    const m = /^http_req_duration\{step:(\d+)\}$/.exec(key);
    if (!m) continue;
    const r = m[1];
    const d = data.metrics[key];
    const f = data.metrics[`http_req_failed{step:${r}}`];
    const c = data.metrics[`http_reqs{step:${r}}`];
    steps.push({ step: Number(r), requests: c ? c.values.count : null, p50_ms: stat(d, "med"), p95_ms: stat(d, "p(95)"), p99_ms: stat(d, "p(99)"), max_ms: stat(d, "max"), error_rate: stat(f, "rate"), broke: broke(d) || broke(f) });
  }
  steps.sort((a, b) => a.step - b.step);
  const reqs = data.metrics.http_reqs;
  const out = { name, base: __ENV.BASE || "", at: new Date().toISOString(), total_requests: reqs ? reqs.values.count : 0, rps: reqs ? Math.round(reqs.values.rate * 10) / 10 : 0, steps, extra: {} };
  for (const k of Object.keys(data.metrics)) {
    if (/^(ws_|db_)/.test(k)) out.extra[k] = data.metrics[k].values;
    const n = /^http_req_duration\{name:(.+)\}$/.exec(k);
    if (n) out.extra[`endpoint ${n[1]}`] = { count: data.metrics[k].values.count, p50: stat(data.metrics[k], "med"), p95: stat(data.metrics[k], "p(95)"), p99: stat(data.metrics[k], "p(99)") };
  }
  let text = `\n${name}: ${out.total_requests} requests, ${out.rps}/s overall\nstep   reqs    p50     p95     p99     err%  broke\n`;
  for (const s of steps) text += `${String(s.step).padEnd(6)} ${String(s.requests).padEnd(7)} ${String(s.p50_ms).padEnd(7)} ${String(s.p95_ms).padEnd(7)} ${String(s.p99_ms).padEnd(7)} ${String(Math.round((s.error_rate ?? 0) * 10000) / 100).padEnd(5)} ${s.broke ? "YES" : ""}\n`;
  for (const [k, v] of Object.entries(out.extra)) text += `${k}: ${JSON.stringify(v)}\n`;
  const stamp = out.at.replace(/[:.]/g, "-");
  return { stdout: text, [`load/results/${name}-${stamp}.json`]: JSON.stringify(out, null, 2) };
}
