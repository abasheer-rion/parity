// Shared parts of the AI app guides, web/connect/<app>/index.html (DEC-0051). Each guide is
// plain HTML; parityLegal() (plugins/legal.ts) fills these markers at build time so the
// three pages say the same thing about tools, limits, privacy and disconnecting:
//   <!--guide:nav-->      links between the guides, the current one marked
//   <!--guide:verify-->   what the AI can verify, with prompts to copy (DEC-0082)
//   <!--guide:flow-->     the diagram of how signing in works
//   <!--guide:consent-->  the diagram of Parity's Allow page
//   <!--guide:tools-->    what the AI can use, from src/lib/mcp/tools.ts
//   <!--guide:limits-->   what it can and cannot do
//   <!--guide:privacy-->  what is logged and kept
//   <!--guide:byom-->     the other way round: your own model inside Parity
import { ORIGIN } from "../src/lib/meta";

export const GUIDES: [string, string][] = [
  ["/connect/", "All AI apps"],
  ["/connect/claude/", "Claude"],
  ["/connect/chatgpt/", "ChatGPT"],
  ["/connect/gemini/", "Gemini"],
];

export const MCP_URL = `${ORIGIN}/mcp`;

export const isGuide = (path: string) => /^\/connect\/[a-z]+\/(index\.html)?$/.test(path);

function nav(path: string): string {
  const here = path.replace(/index\.html$/, "");
  const links = GUIDES.map(([href, label]) => `<a href="${href}"${href === here ? ' aria-current="page"' : ""}>${label}</a>`);
  return `<nav class="gd-nav" aria-label="Guides for each AI app">\n          ${links.join("\n          ")}\n        </nav>`;
}

// Read tools in the order tools/list gives them, in words. The names are what the AI app
// shows when it asks to use one.
const TOOLS: [string, string][] = [
  ["verify_trades", "Verify a trade list or equity curve: a verdict, one sentence, five cards and how many tries it survives. Nothing is saved."],
  ["verify_strategy", "Verify one of Parity's tested strategies with every try we counted, or find the closest ones to a rule set in words."],
  ["verify_claim", "Check a seller's claim, such as a win rate with a take-profit and no stop, and say which numbers cannot hold."],
  ["search_strategies", "Find strategies Parity has tested against the S&P 500, with each one's verdict from the 11 tests."],
  ["get_strategy", "Full results for one strategy: its settings, the 11 tests, yearly returns and its equity curve."],
  ["search_leads", "The best variations from Parity's always-on strategy search, with the luck check."],
  ["list_market_series", "Market data Parity publishes: currencies, rates, commodities, indices and crypto, delayed."],
  ["get_market_series", "The history of one market series."],
  ["news_impact", "What markets did after kinds of news, compared with random days."],
  ["list_academy_lessons", "Parity Academy's courses and lessons."],
  ["get_academy_lesson", "The text of one Academy lesson and its quick check."],
  ["search", "Search strategies, lessons and market series at once."],
  ["fetch", "The full text of an item found with search."],
  ["verify_record", "Old name for verify_trades, kept so existing connections keep working."],
  ["verify_description", "Old name for verify_claim, kept so existing connections keep working."],
  ["list_demo_accounts", "Your Parity Trade demo accounts (virtual money)."],
];

// What an AI can verify, with a prompt to copy for each tool and what comes back.
const PROMPTS: [string, string, string][] = [
  ["verify_trades", "Check these 40 trades with Parity Verify. I tried 12 settings before this one. Starting balance 10,000.",
    "A verdict such as \"Could be luck\", one sentence written from the numbers, the profit per trade, the worst losses, the luck check after 12 tries, signs of peeking or tuning, and what it could not check."],
  ["verify_claim", "Is a 92% win rate with 5% take-profit and no stop possible?",
    "Each claim marked impossible, needs more data or adds up, with the sums: here, losses must average under 57.5% of a position to break even, and with no stop nothing keeps them there."],
  ["verify_strategy", "Verify the strategy 'The Gambit'.",
    "The verdict on our research numbers with every try our research and search have counted, the tests it passed out of 11, and how many tries it survives."],
];

const WRITE_TOOLS: [string, string][] = [
  ["place_demo_order", "Place a limit or stop order in a demo account. Virtual money only."],
  ["save_trade_layout", "Save a chart layout to Parity Trade."],
];

const toolRows = (rows: [string, string][]) => rows.map(([n, d]) => `<tr><th scope="row"><code>${n}</code></th><td>${d}</td></tr>`).join("\n            ");

const BLOCKS: Record<string, string> = {
  verify: `
        <h2 id="verify">What your AI can verify</h2>
        <p>Paste a trade list, name one of our strategies, or quote a seller's claim, and your AI runs Parity Verify with three tools: <code>verify_trades</code>, <code>verify_strategy</code> and <code>verify_claim</code>. They run the same checks as Verify on the website. Nothing you send is saved. How the checks work: <a href="/methodology/">methodology</a>.</p>
        <div class="lg-table-wrap gd-tools" tabindex="0" role="region" aria-label="Prompts to try">
          <table>
            <caption>Prompts to copy, and what comes back</caption>
            <thead><tr><th scope="col">Ask</th><th scope="col">Tool</th><th scope="col">What comes back</th></tr></thead>
            <tbody>
            ${PROMPTS.map(([tool, ask, back]) => `<tr><td>"${ask}"</td><td><code>${tool}</code></td><td>${back}</td></tr>`).join("\n            ")}
            </tbody>
          </table>
        </div>`,

  tools: `
        <div class="lg-table-wrap gd-tools" tabindex="0" role="region" aria-label="Read tools">
          <table>
            <caption>Tools the AI can use once you allow it. All of them only read.</caption>
            <thead><tr><th scope="col">Tool</th><th scope="col">What it does</th></tr></thead>
            <tbody>
            ${toolRows(TOOLS)}
            </tbody>
          </table>
        </div>
        <p>Two more tools change things, and are off unless you turn them on for that app:</p>
        <div class="lg-table-wrap gd-tools" tabindex="0" role="region" aria-label="Tools that change things">
          <table>
            <caption>Tools that need "May make changes"</caption>
            <thead><tr><th scope="col">Tool</th><th scope="col">What it does</th></tr></thead>
            <tbody>
            ${toolRows(WRITE_TOOLS)}
            </tbody>
          </table>
        </div>
        <p>The hosted tools do not run backtests. For that, use the local server described in the <a href="https://github.com/abasheer-rion/parity/blob/main/docs/guides/0006-connecting-ai-tools-to-parity-with-mcp.md">developer guide</a>.</p>`,

  limits: `
        <ul>
          <li><strong>Reads by default.</strong> A connected app can run Verify on trades, strategies and claims it sends, and read tested strategies, market data, news impact, Academy lessons and your demo accounts.</li>
          <li><strong>Changes need your consent.</strong> It can place demo orders or save Trade layouts only if you tick "May make changes" for that app, on the Allow page or later on <a href="/connect/">Connect your AI</a>. Changes are capped at 30 a day.</li>
          <li><strong>Never.</strong> It cannot place real trades, move money, pay for anything, or change your password, email or account settings.</li>
          <li><strong>It acts as you.</strong> It sees what you can see in Parity, and nothing of anyone else's.</li>
          <li><strong>Limits.</strong> 30 calls a minute and 1000 a day for each person, across all apps.</li>
          <li>Answers are research and education only. Not investment advice.</li>
        </ul>`,

  privacy: `
        <ul>
          <li>For each call, Parity logs the app, the tool name, the time, whether it worked and how long it took. It does not store what the app sent or what came back. Log rows are deleted after 90 days.</li>
          <li>Parity never sees your AI app's password or your chats. The AI company handles your chat under its own privacy policy.</li>
          <li>What a tool returns goes to the AI company so the AI can answer you. Do not connect an app you do not trust with your Parity data.</li>
          <li>Details are in the <a href="/legal/privacy/">privacy policy</a>.</li>
        </ul>`,

  byom: `
        <p>Parity can also call a model you bring. The Assistant panel in Workbench, Verify and Trade takes an OpenRouter sign-in, or an Anthropic, OpenAI or Google key. The key stays in your browser and goes straight to that company, so the usage is on your bill. The panel is being tested and is not on for everyone yet.</p>`,

  flow: `
        <figure class="gd-fig">
          <svg viewBox="0 0 720 150" role="img" aria-labelledby="flow-t flow-d" xmlns="http://www.w3.org/2000/svg">
            <title id="flow-t">How connecting works</title>
            <desc id="flow-d">Four steps from left to right. One: you paste the Parity address into your AI app. Two: the app opens Parity's log-in page. Three: you choose Allow on Parity's page. Four: you are back in your AI app, which can now use Parity's tools.</desc>
            <g>
              <rect class="s-panel" x="12" y="30" width="150" height="90" rx="12" />
              <text class="s-title" x="28" y="62">1. Paste</text>
              <text class="s-muted" x="28" y="84">the address into</text>
              <text class="s-muted" x="28" y="102">your AI app</text>
            </g>
            <path class="s-line" d="M166 75h22" /><path class="s-arrow" d="M196 75l-9-5v10z" />
            <g>
              <rect class="s-panel" x="200" y="30" width="150" height="90" rx="12" />
              <text class="s-title" x="216" y="62">2. Log in</text>
              <text class="s-muted" x="216" y="84">on Parity's page,</text>
              <text class="s-muted" x="216" y="102">which opens by itself</text>
            </g>
            <path class="s-line" d="M354 75h22" /><path class="s-arrow" d="M384 75l-9-5v10z" />
            <g>
              <rect class="s-panel" x="388" y="30" width="150" height="90" rx="12" />
              <text class="s-title" x="404" y="62">3. Allow</text>
              <text class="s-muted" x="404" y="84">read only, unless</text>
              <text class="s-muted" x="404" y="102">you tick changes</text>
            </g>
            <path class="s-line" d="M542 75h22" /><path class="s-arrow" d="M572 75l-9-5v10z" />
            <g>
              <rect class="s-panel" x="576" y="30" width="132" height="90" rx="12" />
              <text class="s-title" x="592" y="62">4. Ask</text>
              <text class="s-muted" x="592" y="84">your AI uses</text>
              <text class="s-muted" x="592" y="102">Parity's tools</text>
            </g>
          </svg>
          <figcaption>The first time, your AI app sends you to Parity to log in and allow it. After that it connects by itself.</figcaption>
        </figure>`,

  consent: `
        <figure class="gd-fig">
          <svg viewBox="0 0 720 280" role="img" aria-labelledby="consent-t consent-d" xmlns="http://www.w3.org/2000/svg">
            <title id="consent-t">Parity's Allow page</title>
            <desc id="consent-d">A drawing of the page. The heading asks whether to allow the AI app to use Parity. It lists what the app will be able to read. A box labelled "Also let it make changes" is not ticked. Below are an Allow button and a Deny button.</desc>
            <rect class="s-panel" x="110" y="16" width="500" height="248" rx="14" />
            <text class="s-title" x="136" y="52">Allow Claude to use Parity?</text>
            <text class="s-muted" x="136" y="76">After you allow it, you go back to claude.ai.</text>
            <text class="s-text" x="136" y="108">It will be able to</text>
            <circle class="s-ok" cx="142" cy="128" r="3" /><text class="s-muted" x="152" y="132">Know it is you, and see your email address</text>
            <circle class="s-ok" cx="142" cy="148" r="3" /><text class="s-muted" x="152" y="152">Read strategies, market data, lessons and demo accounts</text>
            <circle class="s-ok" cx="142" cy="168" r="3" /><text class="s-muted" x="152" y="172">Run Verify on numbers it sends</text>
            <rect class="s-tick" x="136" y="186" width="14" height="14" rx="3" />
            <text class="s-text" x="158" y="198">Also let it make changes (demo orders, Trade layouts)</text>
            <rect class="s-btn" x="136" y="218" width="92" height="32" rx="8" />
            <text class="s-btn-text" x="162" y="239">Allow</text>
            <rect class="s-quiet" x="238" y="218" width="92" height="32" rx="8" />
            <text class="s-text" x="266" y="239">Deny</text>
          </svg>
          <figcaption>The box for changes starts unticked. Leave it that way unless you want the AI to place demo orders or save layouts.</figcaption>
        </figure>`,
};

/** Fills the guide markers in one page. */
export function fillGuide(html: string, path: string): string {
  let out = html.replace("<!--guide:nav-->", nav(path)).replaceAll("<!--guide:url-->", MCP_URL);
  for (const [key, block] of Object.entries(BLOCKS)) out = out.replace(`<!--guide:${key}-->`, block.trim());
  return out;
}
