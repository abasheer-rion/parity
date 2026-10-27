// The download page (DEC-0072): fills in the version, sizes and checksums from
// /download/latest/info and marks the card for this computer. The buttons work without it:
// each one links to /download/latest/<platform>, which always fetches the newest release.
import "./page";

interface DownloadFile { platform: string; label: string; name: string; size: number; sha256: string | null; url: string }
interface DownloadInfo { version: string; published: string; notes: string; files: DownloadFile[] }

const mb = (bytes: number) => `${Math.round(bytes / 1e6)} MB`;
const day = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "n/a" : d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
};
const set = (sel: string, text: string) => document.querySelectorAll<HTMLElement>(sel).forEach((el) => { el.textContent = text; });

/** Which installer suits this computer, when the browser says. Intel and Apple silicon Macs report the same, so a Mac gets Apple silicon. */
function guess(): string | null {
  const ua = navigator.userAgent;
  if (/Windows/.test(ua)) return "windows";
  if (/Macintosh|Mac OS X/.test(ua)) return "mac-arm64";
  return null;
}

function cell(text: string, code = false): HTMLTableCellElement {
  const td = document.createElement("td");
  if (code) { const c = document.createElement("code"); c.textContent = text; td.append(c); } else td.textContent = text;
  return td;
}

async function fill() {
  const mine = guess();
  if (mine) document.querySelector(`[data-platform="${mine}"]`)?.setAttribute("data-mine", "");
  const sums = document.querySelector<HTMLElement>("[data-dl-sums]");
  try {
    const res = await fetch("/download/latest/info", { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(String(res.status));
    const info = (await res.json()) as DownloadInfo;
    set("[data-dl-version]", info.version);
    set("[data-dl-date]", day(info.published));
    document.querySelector<HTMLAnchorElement>("[data-dl-notes]")?.setAttribute("href", info.notes);
    for (const f of info.files) {
      const size = document.querySelector<HTMLElement>(`[data-platform="${f.platform}"] [data-dl-size]`);
      if (size) size.textContent = `Version ${info.version}, ${mb(f.size)}`;
    }
    if (sums) sums.replaceChildren(...info.files.map((f) => {
      const tr = document.createElement("tr");
      tr.append(cell(f.name), cell(mb(f.size)), cell(f.sha256 ?? "n/a", true));
      return tr;
    }));
  } catch {
    const status = document.querySelector<HTMLElement>("[data-dl-status]");
    if (status) status.textContent = "The version details could not be loaded. The buttons still download the newest version.";
    if (sums) sums.replaceChildren(Object.assign(document.createElement("tr"), { innerHTML: '<td colspan="3">Could not load the checksums. They are listed with each version on the releases page.</td>' }));
  }
}

void fill();
