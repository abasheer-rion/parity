// A web page's words as plain text, for reading a seller's claims from it (DEC-0088).
// Scripts, styles and hidden parts are dropped, block tags become line breaks and table
// cells a space, so "Growth: 339.96%" on a statistics page stays on one line. The page's
// title and description come first, because sales pages often put their claims there.
// Pure string work: the Pages Function, the API and the tests all use it.

export interface PageText {
  text: string;
  title: string | null;
  /** True when the page builds its words with scripts after it opens, so the HTML holds almost none. */
  scripted: boolean;
}

const ENT: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", minus: "-", ndash: "-", mdash: "-", hellip: "...",
  rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', middot: " ", bull: " ", times: "x", euro: "EUR", pound: "GBP", dollar: "$", percnt: "%",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1));
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : " ";
    }
    return ENT[e.toLowerCase()] ?? m;
  });
}

/** Typographic characters that change how numbers read, made plain: minus signs, thin spaces, curly quotes. */
export function plainChars(s: string): string {
  return s
    .replace(/[\u2212\u2012\u2013\u2014\u2015]/g, "-")
    .replace(/[\u00a0\u2007\u2009\u202f\u200a]/g, " ")
    .replace(/[\u200b\u200c\u200d\ufeff]/g, "")
    .replace(/[\u2018\u2019\u201a\u2032]/g, "'")
    .replace(/[\u201c\u201d\u201e\u2033]/g, '"');
}

const BLOCK = /^(p|div|li|ul|ol|tr|table|tbody|thead|section|article|header|footer|main|aside|nav|h[1-6]|br|hr|dd|dt|dl|blockquote|figure|figcaption|form|fieldset|pre|address|details|summary)$/i;
const CELL = /^(td|th)$/i;

function meta(html: string, name: string): string | null {
  const re = new RegExp(`<meta\\b[^>]*(?:name|property)\\s*=\\s*["']${name}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  const content = tag?.match(/content\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
  const v = content?.[1] ?? content?.[2];
  return v ? plainChars(decodeEntities(v)).replace(/\s+/g, " ").trim() || null : null;
}

/** The words of an HTML page, one block per line. */
export function htmlToText(html: string): PageText {
  const titleRaw = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const title = titleRaw ? plainChars(decodeEntities(titleRaw)).replace(/\s+/g, " ").trim() || null : null;
  const description = meta(html, "description") ?? meta(html, "og:description");
  const scripts = (html.match(/<script\b/gi) ?? []).length;

  const body = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|template|svg|canvas|iframe|object|head)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<\/?([a-z0-9]+)\b[^>]*>/gi, (_, tag: string) => (BLOCK.test(tag) ? "\n" : CELL.test(tag) ? " \t " : " "));

  const lines = plainChars(decodeEntities(body))
    .split(/\n/)
    .map((l) => l.replace(/[ \t\r\f\v]+/g, " ").trim())
    .filter(Boolean);
  const words = lines.join("\n");
  const head = [title, description && description !== title ? description : null].filter((x): x is string => !!x);
  const text = [...head, words].join("\n");
  // A page that is mostly scripts with a few hundred letters of menus has its numbers loaded later.
  const scripted = words.replace(/\s+/g, "").length < 600 && scripts >= 3;
  return { text, title, scripted };
}

/** Plain text a person pasted, or a text/plain page: the same clean-up without the tags. */
export function plainText(s: string): string {
  return plainChars(s).split(/\r?\n/).map((l) => l.replace(/[ \t\f\v]+/g, " ").trim()).filter(Boolean).join("\n");
}
