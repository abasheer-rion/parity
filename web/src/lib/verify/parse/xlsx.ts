// Reading an Excel file (.xlsx) in the browser, enough for the spreadsheets trading platforms
// export: TradingView's Strategy Tester download (sheet "List of trades"), cTrader's history
// (sheet "Records") and MetaTrader 5's "Open XML" report. An xlsx file is a zip of XML files;
// this reads the zip's directory, inflates the parts it needs with the browser's own
// DecompressionStream, and turns each sheet into rows of text. Dates stored as Excel day
// numbers are written out as "YYYY-MM-DD HH:MM:SS" when their cell style is a date format.
// No network, no library.
import { ParseError } from "../csv";

interface Entry { name: string; method: number; size: number; offset: number }

function entries(b: Uint8Array): Entry[] {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  // The end of central directory record is in the last 64 KB.
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65_557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new ParseError("This file is not a complete Excel file. Save it again as .xlsx or CSV.");
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out: Entry[] = [];
  const dec = new TextDecoder();
  for (let k = 0; k < count; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), size = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true), extra = dv.getUint16(p + 30, true), comment = dv.getUint16(p + 32, true);
    const offset = dv.getUint32(p + 42, true);
    out.push({ name: dec.decode(b.subarray(p + 46, p + 46 + nameLen)), method, size, offset });
    p += 46 + nameLen + extra + comment;
  }
  return out;
}

async function read(b: Uint8Array, e: Entry): Promise<string> {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const start = e.offset + 30 + dv.getUint16(e.offset + 26, true) + dv.getUint16(e.offset + 28, true);
  const data = b.subarray(start, start + e.size);
  if (e.method === 0) return new TextDecoder().decode(data);
  if (e.method !== 8) throw new ParseError("This Excel file is compressed in a way Verify cannot read. Save it again as .xlsx or CSV.");
  const stream = new Blob([data.slice() as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new TextDecoder().decode(await new Response(stream).arrayBuffer());
}

const unxml = (s: string) => s.replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-f]+);/gi, (_, e: string) =>
  e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : +e.slice(1)) : ({ lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" } as Record<string, string>)[e.toLowerCase()]);

/** Column letters to a 0-based index: A is 0, AB is 27. */
const colIndex = (ref: string) => [...ref.replace(/\d+$/, "")].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

const pad = (n: number) => String(n).padStart(2, "0");
/** An Excel day number (1900 system) as "YYYY-MM-DD HH:MM:SS". */
export function excelDate(v: number): string {
  const ms = Math.round((v - 25569) * 86_400_000);
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

/** Style indexes whose number format is a date or time. */
function dateStyles(styles: string): Set<number> {
  const custom = new Map<number, string>();
  for (const m of styles.matchAll(/<numFmt\b[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g)) custom.set(+m[1], unxml(m[2]));
  const isDateFmt = (id: number) => (id >= 14 && id <= 22) || (id >= 45 && id <= 47) || (custom.has(id) && /(^|[^"\\])[ymdhs]/i.test(custom.get(id)!.replace(/"[^"]*"/g, "").replace(/\[[^\]]*\]/g, "")));
  const out = new Set<number>();
  const xfs = styles.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/);
  if (!xfs) return out;
  [...xfs[1].matchAll(/<xf\b([^>]*)\/?>/g)].forEach((m, i) => { const id = m[1].match(/numFmtId="(\d+)"/); if (id && isDateFmt(+id[1])) out.add(i); });
  return out;
}

export interface Sheet { name: string; rows: string[][] }

/** Every sheet of an xlsx file, as rows of text. */
export async function readXlsx(buf: ArrayBuffer): Promise<Sheet[]> {
  if (typeof DecompressionStream === "undefined") throw new ParseError("This browser cannot open Excel files. Save the file as CSV, or use a recent Chrome, Edge, Firefox or Safari.");
  const b = new Uint8Array(buf);
  const list = entries(b);
  const get = async (name: string) => { const e = list.find((x) => x.name === name); return e ? read(b, e) : ""; };
  const wb = await get("xl/workbook.xml");
  if (!wb) throw new ParseError("This file is not an Excel workbook. Save it again as .xlsx or CSV.");
  const rels = await get("xl/_rels/workbook.xml.rels");
  const target = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"/g)) target.set(m[1], m[2].replace(/^\/?xl\//, "").replace(/^\//, ""));
  for (const m of rels.matchAll(/<Relationship\b[^>]*\bTarget="([^"]+)"[^>]*\bId="([^"]+)"/g)) target.set(m[2], m[1].replace(/^\/?xl\//, "").replace(/^\//, ""));
  const shared: string[] = [];
  const sst = await get("xl/sharedStrings.xml");
  for (const si of sst.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) shared.push(unxml([...si[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")));
  const dates = dateStyles(await get("xl/styles.xml"));
  const sheets: Sheet[] = [];
  for (const m of wb.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const name = unxml(m[1].match(/name="([^"]*)"/)?.[1] ?? "");
    const rid = m[1].match(/r:id="([^"]*)"/)?.[1] ?? "";
    const xml = await get(`xl/${target.get(rid) ?? ""}`);
    const rows: string[][] = [];
    for (const row of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells: string[] = [];
      for (const c of row[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = c[1], inner = c[2] ?? "";
        const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1];
        const i = ref ? colIndex(ref) : cells.length;
        const type = attrs.match(/\bt="([^"]+)"/)?.[1];
        const style = +(attrs.match(/\bs="(\d+)"/)?.[1] ?? -1);
        const v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
        let val = "";
        if (type === "s" && v != null) val = shared[+v] ?? "";
        else if (type === "inlineStr") val = unxml([...inner.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(""));
        else if (type === "b") val = v === "1" ? "TRUE" : "FALSE";
        else if (v != null) val = type === "str" || type === "e" ? unxml(v) : dates.has(style) && Number.isFinite(+v) ? excelDate(+v) : v;
        while (cells.length < i) cells.push("");
        cells[i] = val.trim();
      }
      while (cells.length && cells[cells.length - 1] === "") cells.pop();
      rows.push(cells);
    }
    sheets.push({ name, rows });
  }
  return sheets;
}

/** True when the bytes are a zip file (an xlsx is one). */
export const isZip = (buf: ArrayBuffer) => { const b = new Uint8Array(buf, 0, Math.min(4, buf.byteLength)); return b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04; };
