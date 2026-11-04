// robots.txt, read as RFC 9309 says (DEC-0088): the group for our product token, or "*"
// when there is none; the longest matching rule wins, and an allow wins a tie; "*" matches
// any run of characters and "$" ends the path. Verify fetches a seller's page only when
// this says it may.

/** The product token we look for in robots.txt and send in User-Agent. */
export const AGENT_TOKEN = "ParityVerify";

interface Rule { allow: boolean; path: string }
interface Group { agents: string[]; rules: Rule[] }

export function parseRobots(txt: string): Group[] {
  const groups: Group[] = [];
  let cur: Group | null = null;
  let lastWasAgent = false;
  for (const raw of txt.split(/\r\n|\r|\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase(), value = m[2].trim();
    if (key === "user-agent") {
      if (!cur || !lastWasAgent) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if (key === "allow" || key === "disallow") {
      lastWasAgent = false;
      if (!cur) continue;
      // An empty disallow allows everything; it adds no rule.
      if (value === "" && key === "disallow") continue;
      cur.rules.push({ allow: key === "allow", path: value });
    } else {
      lastWasAgent = false;
    }
  }
  return groups;
}

/** RFC 9309 section 2.2.2: "*" for any characters, "$" at the end anchors it. */
function matches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const re = new RegExp(`^${body.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*")}${anchored ? "$" : ""}`);
  return re.test(path);
}

/** Percent-encoding made comparable: decode what does not need encoding, upper-case the rest. */
function norm(p: string): string {
  return p.replace(/%([0-9a-f]{2})/gi, (_m, h: string) => {
    const c = String.fromCharCode(parseInt(h, 16));
    return /[A-Za-z0-9\-._~]/.test(c) ? c : `%${h.toUpperCase()}`;
  });
}

/** Whether `agent` may fetch `pathAndQuery` ("/en/signals/123?x=1") under these rules. */
export function robotsAllows(txt: string, pathAndQuery: string, agent = AGENT_TOKEN): boolean {
  const groups = parseRobots(txt);
  const token = agent.toLowerCase();
  const ours = groups.filter((g) => g.agents.includes(token));
  const rules = (ours.length ? ours : groups.filter((g) => g.agents.includes("*"))).flatMap((g) => g.rules);
  const path = norm(pathAndQuery || "/");
  let best: Rule | null = null;
  for (const r of rules) {
    const p = norm(r.path);
    if (!matches(p, path)) continue;
    const len = p.replace(/\$$/, "").length;
    const bestLen = best ? norm(best.path).replace(/\$$/, "").length : -1;
    if (len > bestLen || (len === bestLen && r.allow && !best!.allow)) best = r;
  }
  // robots.txt itself is always allowed.
  if (path === "/robots.txt") return true;
  return !best || best.allow;
}
