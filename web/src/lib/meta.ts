// Every page's title, description, share card and search hints, in one place (DEC-0038).
//
//   site.json             the site's address and names. Moving to the real domain is a
//                         one-line change there: "origin".
//   PAGES                 one entry per built HTML file. plugins/meta.ts writes the <head>
//                         tags from it at build time, replacing any that the file carries.
//   ROUTES_META           one entry per in-app page (#/strategy/<id>, #/verify, ...).
//                         useRouteMeta() sets the tab title and share tags as people move.
//   OG_CARDS              the words on each share image (/og/<key>.png), drawn at build by
//                         plugins/meta.ts and on demand by the /og/ functions.
//
// No browser globals at import time: the Vite plugin, the Cloudflare functions and the
// tests all read this file.
import site from "./site.json";
import { RAW } from "../ui/tokens.gen";

export const ORIGIN: string = site.origin.replace(/\/$/, "");
export const HOST: string = new URL(ORIGIN).host;
export const SITE_NAME: string = site.name;
export const LEGAL_NAME: string = site.legalName;
export const CONTACT: string = site.email;
/** The browser bar colour: the page canvas token. site.json repeats it for the Python SEO
 *  builder, and a test keeps the two equal. */
export const THEME_COLOR: string = RAW["color-canvas"];

/**
 * The domain whose subdomains share the sign-in cookie: parity.endyland.com gives
 * endyland.com, and an apex such as paritytrading.ai gives itself.
 */
export function parentDomain(host: string): string {
  const parts = host.toLowerCase().split(".");
  return parts.length > 2 ? parts.slice(1).join(".") : parts.join(".");
}

export const SITE_DOMAIN: string = parentDomain(HOST);
/** Parity Terminal's own address (DEC-0020, DEC-0024). */
export const SIM_ORIGIN = `https://sim.${SITE_DOMAIN}`;
/** Parity Trade's own address (DEC-0040). */
export const TRADE_ORIGIN = `https://trade.${SITE_DOMAIN}`;
/** Parity Academy's own address (DEC-0042). */
export const ACADEMY_ORIGIN = `https://academy.${SITE_DOMAIN}`;
/** Parity Workbench's own address (DEC-0043). */
export const LAB_ORIGIN = `https://lab.${SITE_DOMAIN}`;

/** The logo drawn on every share card. */
export const LOGO_PATH = "/brand/2026-10-22-wordmark/parity-lockup-on-dark.svg";

export const abs = (path: string) => (/^https?:/.test(path) ? path : `${ORIGIN}${path}`);
export const ogImage = (key: string) => abs(`/og/${key}.png`);

// ---------------------------------------------------------------- share cards

export interface OgCard { kicker: string; title: string; sub: string }

/** The words on each static share image. Keys are file names under /og/. */
export const OG_CARDS: Record<string, OgCard> = {
  default: { kicker: "Parity", title: "Check trading records and strategies", sub: "Trade logs checked for luck. Strategies backtested against the S&P 500, with every result shown." },
  learn: { kicker: "Parity Learn", title: "Learn the words of trading", sub: "Over 300 trading terms, each with a simple explanation, an everyday comparison and a precise definition." },
  ideas: { kicker: "Parity Ideas", title: "Trading ideas, with the evidence", sub: "Where each idea came from, what the evidence says and why it might fail." },
  notes: { kicker: "Parity Notes", title: "Parity research notes", sub: "How Parity decides, what the research found and how the numbers work." },
  blog: { kicker: "Parity Blog", title: "Research, analysis and opinion", sub: "Write-ups from the Parity team. Every post is labelled as fact-based reporting, analysis or opinion." },
  news: { kicker: "Parity News", title: "Company news and press releases", sub: "Updates from Parity. Market headlines and their impact are in the app." },
  verify: { kicker: "Parity Verify", title: "Check a trading record", sub: "Profit per trade, the worst loss and whether the result could be luck." },
  app: { kicker: "Parity", title: "Trading strategies tested against the S&P 500", sub: "Discover strategies, compare them with the S&P 500 and see every result." },
  research: { kicker: "Parity Research", title: "Research docs, official runs and data", sub: "The docs, the ledger of official runs, the strategy search and the data behind them." },
  sim: { kicker: "Parity Terminal", title: "Market data, replays and simulations", sub: "Macro, currencies, commodities, crisis replays and simulated paths, all from past data." },
  trade: { kicker: "Parity Trade", title: "Charts, watchlists and paper trading", sub: "Charts on delayed data, a screener and demo accounts. No real money." },
  academy: { kicker: "Parity Academy", title: "Short courses on markets and research", sub: "Lessons of two or three minutes, each with a step-by-step picture and a quick check. Progress is saved to your account." },
  lab: { kicker: "Parity Workbench", title: "Try settings, what if, compare and search", sub: "Strategy settings, past events, side by side tables, the strategy search and the Edge Lab checklist in one full-screen tool." },
  strategy: { kicker: "Parity strategy", title: "A strategy, tested against the S&P 500", sub: "How it did, where it fails and whether the result could be luck." },
  login: { kicker: "Parity", title: "Log in to Parity", sub: "Check trading records and follow tested strategies." },
  legal: { kicker: "Parity legal", title: "Legal", sub: "Privacy, terms, cookies, accessibility and risk." },
  badge: { kicker: "Parity Verify", title: "A checked trading record", sub: "What Parity checked in the file, and what it could not." },
};

// ---------------------------------------------------------------- structured data

const ORG_ID = `${ORIGIN}/#org`;

export function orgLd() {
  return { "@type": "Organization", "@id": ORG_ID, name: LEGAL_NAME, alternateName: SITE_NAME, url: `${ORIGIN}/`, logo: abs("/icon-512.png"), email: CONTACT };
}

export function websiteLd() {
  return { "@type": "WebSite", "@id": `${ORIGIN}/#site`, name: SITE_NAME, url: `${ORIGIN}/`, publisher: { "@id": ORG_ID }, inLanguage: "en" };
}

export function verifyAppLd() {
  return {
    "@type": "SoftwareApplication", "@id": `${ORIGIN}/#verify`, name: "Parity Verify", applicationCategory: "FinanceApplication",
    operatingSystem: "Web", url: abs("/app/#/verify"), publisher: { "@id": ORG_ID },
    description: "Checks whether a trading record holds up: profit per trade, the worst loss, and whether the result could be luck.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };
}

// ---------------------------------------------------------------- pages

export interface PageMeta {
  title: string;
  description: string;
  /** The page's own address, for the canonical link and og:url. */
  path?: string;
  /** A key of OG_CARDS, or an image address. */
  image?: string;
  imageAlt?: string;
  /** Pages behind sign-in say so; public pages leave it out (DEC-0023). */
  robots?: string;
  type?: "website" | "article";
  themeColor?: string;
  manifest?: string;
  /** The sim's manifest is behind sign-in, so the browser must send the cookie for it. */
  manifestCredentials?: boolean;
  ld?: object[];
}

export const PRIVATE = "noindex, nofollow";

/** One entry per built HTML file, keyed by its path under web/. */
export const PAGES: Record<string, PageMeta> = {
  "index.html": {
    title: "Parity: check trading records and strategies",
    description: "Check a trade log for profit per trade, worst losses and luck, and see trading strategies backtested against the S&P 500 after costs.",
    path: "/", image: "default", type: "website", ld: [orgLd(), websiteLd(), verifyAppLd()], manifest: "/manifest.webmanifest",
  },
  "login/index.html": { title: "Log in · Parity", description: "Log in to Parity to follow strategies tested against the S&P 500.", path: "/login/", image: "login" },
  "signup/index.html": { title: "Sign up · Parity", description: "Create a free Parity account to check trading records and follow strategies tested against the S&P 500.", path: "/signup/", image: "login" },
  "reset/index.html": { title: "Reset password · Parity", description: "Choose a new password for your Parity account.", path: "/reset/", image: "login" },
  "verify/index.html": { title: "Confirm · Parity", description: "Confirming your email address for Parity.", path: "/verify/", image: "login" },
  // AI apps connecting to Parity (DEC-0051): the how-to and connected apps, the consent page
  // Supabase Auth's OAuth server sends people to, and the OpenRouter sign-in return page.
  "connect/index.html": { title: "Connect your AI · Parity", description: "Add Parity to Claude, ChatGPT, Gemini CLI, Cursor and other AI apps, and manage the apps you connected.", path: "/connect/", image: "login", robots: PRIVATE },
  "oauth/consent/index.html": { title: "Allow an AI app · Parity", description: "Choose whether an AI app may use Parity as you.", path: "/oauth/consent/", image: "login", robots: PRIVATE },
  "oauth/openrouter/index.html": { title: "Connecting OpenRouter · Parity", description: "Finishing the connection to your OpenRouter account.", path: "/oauth/openrouter/", image: "login", robots: PRIVATE },
  // Every /v/<id> serves this page; functions/v/[id].ts swaps in that badge's own tags.
  "v/index.html": {
    title: "Verified record · Parity", description: "A Parity Verify record: what was checked in a trading record, and what was not.",
    image: "badge", robots: PRIVATE, ld: [verifyAppLd()],
  },
  // Served by Cloudflare Pages, with status 404, at any address that does not exist (DEC-0055).
  "404.html": { title: "Page not found · Parity", description: "There is no Parity page at this address.", image: "default", robots: PRIVATE },
  "legal/index.html": { title: "Legal · Parity", description: "Parity's privacy policy, terms, cookie policy, accessibility statement, risk notice and regulatory status.", path: "/legal/", image: "legal" },
  "legal/privacy/index.html": { title: "Privacy policy · Parity", description: "What Parity collects, why, how long we keep it, who processes it, and your rights.", path: "/legal/privacy/", image: "legal" },
  "legal/terms/index.html": { title: "Terms of service · Parity", description: "The terms for using Parity, a research and education service. Not investment advice, not a broker.", path: "/legal/terms/", image: "legal" },
  "legal/cookies/index.html": { title: "Cookie policy · Parity", description: "Every cookie and browser storage item Parity uses, and what our own analytics records if you switch it on.", path: "/legal/cookies/", image: "legal" },
  "legal/accessibility/index.html": { title: "Accessibility statement · Parity", description: "Parity's accessibility target, the known gaps, and how to report a barrier.", path: "/legal/accessibility/", image: "legal" },
  "legal/risk/index.html": { title: "Risk notice · Parity", description: "Why backtests and simulations can mislead, and the risks of crypto, perpetual futures, leverage and ETFs.", path: "/legal/risk/", image: "legal" },
  "legal/regulatory/index.html": { title: "Regulatory status and your rights · Parity", description: "What Parity is and is not, the laws and exemptions it relies on, your rights, and where to complain.", path: "/legal/regulatory/", image: "legal" },
  // The signed-in apps. Their tags change with each page (ROUTES_META); these are what a
  // link preview shows, since the server answers a signed-out visitor with a redirect.
  "app/index.html": { title: "Parity", description: OG_CARDS.app.sub, path: "/app/", image: "app", robots: PRIVATE, manifest: "/manifest.webmanifest" },
  "research/index.html": { title: "Parity Research", description: OG_CARDS.research.sub, path: "/research/", image: "research", robots: PRIVATE, manifest: "/manifest.webmanifest" },
  "sim/index.html": { title: "Parity Terminal", description: OG_CARDS.sim.sub, path: "/sim/", image: "sim", robots: PRIVATE, themeColor: RAW["palette-black"], manifest: "/sim/manifest.webmanifest", manifestCredentials: true },
  "trade/index.html": { title: "Parity Trade", description: OG_CARDS.trade.sub, path: "/trade/", image: "trade", robots: PRIVATE, manifest: "/trade/manifest.webmanifest", manifestCredentials: true },
  "academy/index.html": { title: "Parity Academy", description: OG_CARDS.academy.sub, path: "/academy/", image: "academy", robots: PRIVATE, manifest: "/academy/manifest.webmanifest", manifestCredentials: true },
  "lab/index.html": { title: "Parity Workbench", description: OG_CARDS.lab.sub, path: "/lab/", image: "lab", robots: PRIVATE, manifest: "/lab/manifest.webmanifest", manifestCredentials: true },
};

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const META_START = "<!--meta-->";
export const META_END = "<!--/meta-->";

/** The <head> tags for a page, between the two markers. */
export function renderHead(m: PageMeta): string {
  const image = m.image ? (OG_CARDS[m.image] ? ogImage(m.image) : abs(m.image)) : ogImage("default");
  const url = m.path ? abs(m.path) : undefined;
  const t = esc(m.title), d = esc(m.description);
  const lines = [
    `<title>${t}</title>`,
    `<meta name="description" content="${d}" />`,
    m.robots ? `<meta name="robots" content="${esc(m.robots)}" />` : "",
    url ? `<link rel="canonical" href="${esc(url)}" />` : "",
    `<meta name="theme-color" content="${esc(m.themeColor ?? THEME_COLOR)}" />`,
    `<link rel="icon" href="/favicon.svg" type="image/svg+xml" />`,
    `<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png" />`,
    `<link rel="apple-touch-icon" href="/apple-touch-icon.png" />`,
    m.manifest ? `<link rel="manifest" href="${esc(m.manifest)}"${m.manifestCredentials ? ` crossorigin="use-credentials"` : ""} />` : "",
    `<meta property="og:site_name" content="${esc(SITE_NAME)}" />`,
    `<meta property="og:type" content="${m.type ?? "website"}" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    url ? `<meta property="og:url" content="${esc(url)}" />` : "",
    `<meta property="og:image" content="${esc(image)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${esc(m.imageAlt ?? m.title)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    `<meta name="twitter:image" content="${esc(image)}" />`,
    m.ld?.length ? `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@graph": m.ld }).replace(/</g, "\\u003c")}</script>` : "",
  ].filter(Boolean);
  return `${META_START}\n    ${lines.join("\n    ")}\n    ${META_END}`;
}

// Tags this file owns. Any copy left in an HTML file is removed, so a page never has two.
const OWNED = [
  /<!--meta-->[\s\S]*?<!--\/meta-->\s*/g,
  /<title>[\s\S]*?<\/title>\s*/gi,
  /<meta\s+name="(?:description|robots|theme-color|twitter:[\w:]+)"[^>]*>\s*/gi,
  /<meta\s+property="og:[\w:]+"[^>]*>\s*/gi,
  /<link\s+rel="(?:canonical|icon|apple-touch-icon|manifest)"[^>]*>\s*/gi,
  /<script\s+type="application\/ld\+json">[\s\S]*?<\/script>\s*/gi,
];

/** Puts the page's tags into an HTML document's <head>, after the viewport line. */
export function withHead(html: string, m: PageMeta): string {
  const at = html.search(/<\/head>/i);
  if (at < 0) return html;
  let head = html.slice(0, at);
  for (const re of OWNED) head = head.replace(re, "");
  const anchor = head.match(/<meta\s+name="viewport"[^>]*>\s*/i) ?? head.match(/<meta\s+charset[^>]*>\s*/i) ?? head.match(/<head[^>]*>\s*/i);
  const cut = anchor ? (anchor.index ?? 0) + anchor[0].length : head.length;
  const indent = anchor?.[0].match(/\n([ \t]*)$/)?.[1] ?? "    ";
  head = `${head.slice(0, cut)}${renderHead(m)}\n${indent}${head.slice(cut)}`;
  return head + html.slice(at);
}

// ---------------------------------------------------------------- in-app pages

export type AppSpace = "product" | "research" | "sim";

interface RouteMeta { title: string; description: string; image?: string }

const R = (title: string, description: string, image?: string): RouteMeta => ({ title, description, image });

/** Titles and descriptions for the hash routes of /app/ and /research/ (src/lib/space.ts). */
export const ROUTES_META: Record<string, RouteMeta> = {
  start: R("Start here", "What Parity is, how to read a result and where to go first."),
  how: R("How it works", "How Parity tests a trading idea, from the data to the 11 tests."),
  learn: R("Learn", OG_CARDS.learn.sub, "learn"),
  settings: R("Settings", "Your Parity account, preferences and security."),
  ui: R("UI library", "The parts every Parity page is built from."),
  strategies: R("Strategies", "Every strategy Parity tests, each against the S&P 500.", "strategy"),
  strategy: R("Strategy", OG_CARDS.strategy.sub, "strategy"),
  watchlist: R("Watchlist", "The strategies you follow."),
  compare: R("Compare", "Strategies side by side, against the S&P 500."),
  lab: R("Lab", "Try a strategy with your own settings."),
  scenarios: R("Scenarios", "What markets did after past events like the one you describe."),
  news: R("News", "Market news, ranked by how much it moved prices."),
  markets: R("Markets", "Crypto, ETFs, perpetuals and new filings, on delayed data."),
  trade: R("Trade", OG_CARDS.trade.sub, "trade"),
  academy: R("Academy", "Short animated courses on reading backtests, luck, markets, rates, crypto and news."),
  verify: R("Verify", OG_CARDS.verify.sub, "verify"),
  docs: R("Docs", "Every decision, test and reading note behind Parity.", "research"),
  doc: R("Doc", "A Parity research document.", "notes"),
  refs: R("References", "Every paper, book and source Parity cites.", "research"),
  search: R("Strategy search", "Every variation the strategy search has tried, with its luck check, Sharpe ratio and worst fall.", "research"),
  ledger: R("Ledger", "Official runs, sealed before the results were known.", "research"),
  catalog: R("Catalog", "The library of trading ideas, each with a report.", "ideas"),
  algo: R("Idea", "A trading idea from the catalog, with the evidence.", "ideas"),
  sim: R("Sim World", OG_CARDS.sim.sub, "sim"),
  signals: R("Signals", "How much information each signal carries.", "research"),
  explore: R("Explore", "Chart the raw price series behind the strategies.", "research"),
  data: R("Data", "The data behind the latest run.", "research"),
  sources: R("Data sources", "Where every number comes from.", "research"),
  metrics: R("Metrics", "How people use Parity: pages, clicks, the sign-up funnel, retention and errors. Team only.", "research"),
  registry: R("Data catalog", "Every data source and series: display rights, status, health, where it is used and the tests run when it arrived.", "research"),
  latency: R("Latency", "How old each source is, how long each job takes and how fast pages load their data.", "research"),
  edges: R("Edge Lab", "Seven checks for a backtest, each with a mistake from our own research.", "research"),
  competitors: R("Competitors", "What public posts praise and complain about in 22 trading products, counted by theme, and what Parity takes from each.", "research"),
  private: R("Private markets", "Property index smoothing, Form D counts, BDC loan marks and credit data from free sources.", "research"),
};

/** Parity Terminal's workspaces and its old Sim World tabs (src/terminal/layout.ts, functions.ts). */
export const SIM_TABS: Record<string, string> = {
  overview: "Overview", macro: "Macro", fx: "FX", commodities: "Commodities", simlab: "Sim lab", world: "World",
  map: "World map", crises: "Crises", scenario: "Scenario", paths: "Paths", stress: "Stress test", race: "Race",
  rates: "Rates", connections: "Connections", stocks: "Stocks", bots: "Bot Battle",
};

const SUFFIX: Record<AppSpace, string> = { product: "Parity", research: "Parity Research", sim: "Parity Terminal" };

export interface LiveMeta { title: string; description: string; image: string }

/** The title and share tags for an in-app page. `name` is a human name for `arg` when known. */
export function routeMeta(space: AppSpace, route: string, arg?: string, name?: string): LiveMeta {
  if (space === "sim") {
    const tab = SIM_TABS[route];
    return { title: tab ? `${tab} · ${SUFFIX.sim}` : SUFFIX.sim, description: OG_CARDS.sim.sub, image: ogImage("sim") };
  }
  const base = ROUTES_META[route];
  const fallback = space === "research" ? "research" : "app";
  if (!base) return { title: SUFFIX[space], description: OG_CARDS[fallback].sub, image: ogImage(fallback) };
  const label = name ?? (arg && (route === "doc" || route === "algo") ? arg : undefined);
  const title = `${label ?? base.title} · ${SUFFIX[space]}`;
  const image = route === "strategy" && arg ? abs(`/og/strategy/${encodeURIComponent(arg)}.png`) : ogImage(base.image ?? fallback);
  return { title, description: base.description, image };
}
