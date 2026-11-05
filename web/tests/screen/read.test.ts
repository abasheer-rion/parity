// Reading a firm's upload (DEC-0087): one long CSV with an account column, a zip of
// per-account files, a details file, and the synthetic sample, which must give the same
// numbers as the ones the business pages print.
// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { outcomeOf, passedOf, readBatch } from "../../src/lib/screen/read";
import { headline, toInputs } from "../../src/lib/screen/sample";
import { screenSync, summarise } from "../../src/lib/screen/score";
import { simulate } from "../../src/lib/screen/simulate";
import { isZip, readZip } from "../../src/lib/screen/unzip";

const enc = (s: string) => new TextEncoder().encode(s);

/** A zip with one entry per file: stored, or deflated with the platform's CompressionStream. */
async function makeZip(files: Record<string, string>, deflate = false): Promise<Uint8Array> {
  const parts: Uint8Array[] = [], central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const raw = enc(text);
    const data = deflate ? new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer()) : raw;
    const n = enc(name);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(8, deflate ? 8 : 0, true);
    local.setUint32(18, data.length, true); local.setUint32(22, raw.length, true); local.setUint16(26, n.length, true);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(10, deflate ? 8 : 0, true);
    c.setUint32(20, data.length, true); c.setUint32(24, raw.length, true); c.setUint16(28, n.length, true); c.setUint32(42, offset, true);
    parts.push(new Uint8Array(local.buffer), n, data);
    central.push(new Uint8Array(c.buffer), n);
    offset += 30 + n.length + data.length;
  }
  const cdSize = central.reduce((s, p) => s + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, Object.keys(files).length, true); end.setUint16(10, Object.keys(files).length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((s, p) => s + p.length, 0));
  let p = 0;
  for (const a of all) { out.set(a, p); p += a.length; }
  return out;
}

const tradeRows = (n: number, pnl: (i: number) => number) =>
  Array.from({ length: n }, (_, i) => `2026-07-${String(1 + Math.floor(i / 3)).padStart(2, "0")} ${10 + (i % 3)}:00:00,EURUSD,${pnl(i).toFixed(2)}`);

describe("reading the upload", () => {
  it("splits one long CSV by its account column and reads the details columns in it", async () => {
    const lines = ["Account,Close Time,Symbol,Profit,Starting Balance,Attempts"];
    for (const id of ["A-1", "A-2"]) for (const r of tradeRows(32, (i) => (i % 2 ? 120 : -80))) lines.push(`${id},${r},50000,${id === "A-1" ? 1 : 4}`);
    const out = await readBatch([{ name: "batch.csv", bytes: enc(lines.join("\n")) }]);
    expect(out.shape).toBe("long");
    expect(out.accounts.map((a) => [a.id, a.trades.length, a.balance, a.tries])).toEqual([["A-1", 32, 50000, 1], ["A-2", 32, 50000, 4]]);
  });

  it("reads a zip with one trade file per account, plus a details file inside it", async () => {
    const file = (pnl: (i: number) => number) => ["Close Time,Symbol,Profit", ...tradeRows(31, pnl)].join("\n");
    const details = "account,passed,outcome,account size\nT1,yes,payout,25000\nT2,no,,\nT3,yes,breached,10000\n";
    for (const deflate of [false, true]) {
      const zip = await makeZip({ "batch/T1.csv": file((i) => (i % 2 ? 90 : -40)), "batch/T2.csv": file(() => -10), "__MACOSX/._T1.csv": "x", "batch/details.csv": details }, deflate);
      expect(isZip(zip)).toBe(true);
      expect((await readZip(zip)).map((e) => e.name)).toEqual(["batch/T1.csv", "batch/T2.csv", "batch/details.csv"]);
      const out = await readBatch([{ name: "batch.zip", bytes: zip }]);
      expect(out.shape).toBe("per-file");
      expect(out.details).toBe(true);
      expect(out.accounts.map((a) => [a.id, a.passed, a.outcome, a.balance])).toEqual([["T1", true, "payout", 25000], ["T2", false, null, null]]);
      expect(out.notes[0]).toMatch(/^1 account is in the details but has no trades/);
    }
  });

  it("reads a separate details file", async () => {
    const lines = ["login,close_time,pnl", ...tradeRows(30, () => 5).map((r) => `L9,${r.split(",")[0]},${r.split(",")[2]}`)];
    const out = await readBatch([{ name: "t.csv", bytes: enc(lines.join("\n")) }], { name: "d.csv", bytes: enc("Login,Status,Outcome,Balance\nL9,Passed,Paid out,200000\n") });
    expect(out.accounts[0]).toMatchObject({ id: "L9", passed: true, outcome: "payout", balance: 200000 });
  });

  it("reads the words firms use for passed and outcome", () => {
    expect([passedOf("Yes"), passedOf("funded"), passedOf("FAILED"), passedOf("?")]).toEqual([true, true, false, null]);
    expect([outcomeOf("Payout"), outcomeOf("paid out"), outcomeOf("Blow-up"), outcomeOf("breached"), outcomeOf("")]).toEqual(["payout", "payout", "blowup", "blowup", null]);
  });

  it("refuses a damaged zip in plain words", async () => {
    const zip = await makeZip({ "a.csv": "x" });
    await expect(readZip(zip.slice(0, zip.length - 22))).rejects.toThrow(/damaged/);
  });
});

describe("the synthetic sample", () => {
  const dir = resolve(import.meta.dirname, "../../public/business/prop-firms/sample");

  it("is up to date: the committed files and numbers are what the generator and the screen give", () => {
    const accounts = simulate();
    expect(JSON.parse(readFileSync(resolve(dir, "summary.json"), "utf8"))).toEqual(JSON.parse(JSON.stringify(headline(accounts))));
  });

  it("gives the same report from the CSV files as from the simulation", async () => {
    const read = await readBatch([{ name: "trades.csv", bytes: readFileSync(resolve(dir, "trades.csv")) }], { name: "details.csv", bytes: readFileSync(resolve(dir, "details.csv")) });
    expect(read.accounts).toHaveLength(500);
    const fromCsv = summarise(screenSync(read.accounts));
    const fromSim = summarise(screenSync(toInputs(simulate())));
    expect(fromCsv).toEqual(fromSim);
  });

  it("has every style and both outcomes, and is labelled synthetic", () => {
    const h = headline(simulate());
    expect(h.synthetic).toBe(true);
    expect(h.accounts).toBe(500);
    expect(Object.values(h.byStyle).every((s) => s.accounts > 0)).toBe(true);
    expect(h.backtest!.n).toBeGreaterThan(30);
    expect(readFileSync(resolve(dir, "details.csv"), "utf8").split("\n")[0]).toContain("synthetic_style");
  });
});
