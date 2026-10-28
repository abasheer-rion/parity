---
id: REF-0027
title: AI connector directory submissions for Claude, ChatGPT and Gemini
type: reference
status: current
created: 2026-10-26
updated: 2026-10-26
authors: [ayan]
tags: [infra, process]
related: [DEC-0051, DEC-0069, REF-0017, GDE-0006]
---

# AI connector directory submissions for Claude, ChatGPT and Gemini

## In plain words

Everything the owner needs to list Parity in Anthropic's connector directory, OpenAI's plugin directory (ChatGPT) and the Gemini CLI extensions gallery. Nothing here was submitted and no accounts were made. Each directory needs the owner to sign in and send it.

Parity already connects to Claude, ChatGPT, Gemini CLI, Cursor and VS Code by address, without any directory listing. The setup pages are [/connect/claude/](https://paritytrading.app/connect/claude/), [/connect/chatgpt/](https://paritytrading.app/connect/chatgpt/) and [/connect/gemini/](https://paritytrading.app/connect/gemini/). A listing only makes Parity easier to find.

## Summary

- Server: `https://paritytrading.app/mcp`. Sign-in: OAuth 2.1 through Supabase Auth, with automatic client registration and PKCE ([DEC-0051](../decisions/0051-ai-apps-connect-to-parity-through-a-hosted-mcp-server-and-people-bring-their-own-model.md)).
- Before any submission: keep `MCP_WRITE_ENABLED` off, make a test account (below), and finish owner step 2 of DEC-0051.
- Both Anthropic and OpenAI refuse tools that trade or move money. Parity's two change tools only touch demo accounts, but list them as off and say so in the safety notes.
- Gemini has no form. Its gallery lists public GitHub repositories that carry a `gemini-extension.json` file and the `gemini-cli-extension` topic.

## What was tested on 26 October 2026

A script played each AI app's part, with that app's own return address, against the live service. It used no real account and stopped at Parity's Allow page, which needs a log-in.

| App | Return address used | Registered | Sign-in reached Parity's Allow page |
| --- | --- | --- | --- |
| Claude (web, desktop, phone) | `https://claude.ai/api/mcp/auth_callback` | yes | yes |
| ChatGPT | `https://chatgpt.com/connector_platform_oauth_redirect` and `https://chatgpt.com/connector/oauth/<id>` | yes | yes |
| Claude Code | `http://localhost:<port>/callback` | yes | yes |
| Gemini CLI | `http://localhost:<port>/oauth/callback` | yes | yes |
| Cursor | `http://localhost:8787/callback` | yes | yes |
| VS Code | `http://127.0.0.1:33418/` and `https://vscode.dev/redirect` | yes | yes |

Also checked:

- `/.well-known/oauth-protected-resource/mcp` names `https://paritytrading.app/mcp` and the Supabase sign-in server. A call without a token gets 401 with the `resource_metadata` pointer.
- Sign-in without PKCE is refused. A return address the app did not register is refused. A made-up code at the token step gets `invalid_grant`.
- Asking for `offline_access` (Claude and Cursor do, so they stay signed in) is accepted. The Allow page now describes it in words.
- Browser calls from claude.ai, chatgpt.com and vscode.dev were refused with 403. They are now allowed, since `/mcp` takes only a bearer token.
- The test registrations, named `parity-probe-*`, were marked deleted in Supabase afterwards.

Not tested: a full sign-in with a real account, and tool calls with a real token. That is the manual test plan in DEC-0051.

## Listing text

Use the same words everywhere. They follow [REF-0017](0017-parity-copy-rules.md).

- **Name:** Parity
- **One line (under 200 characters):** Look up trading strategies tested against the S&P 500, check a trading record for luck, and read market data and lessons. Read only.
- **Description (under 2000 characters):**

  > Parity tests trading strategies against the S&P 500 after costs and publishes the results, including the ones that fail. Connect Parity to look up those results from a chat.
  >
  > With Parity connected, your AI can find tested strategies and show each one's verdict from 11 tests, open the full results for one strategy, see the best variations from Parity's always-on strategy search with the luck check, run Parity Verify on a trade list or equity curve you paste, on one of Parity's tested strategies, or on a seller's claim to find numbers that cannot hold, read delayed market data for currencies, rates, commodities, indices and crypto, see what markets did after kinds of news, and read Parity Academy lessons.
  >
  > It acts as you and sees only what you can see. It only reads. Placing demo orders with virtual money and saving chart layouts are off unless you turn them on for that app in Parity. It cannot trade real money, move money, pay for anything or change your account. Each person gets 30 calls a minute and 1000 a day. Parity logs the tool name and time of each call, not what was sent.
  >
  > Research and education only. Not investment advice.

- **Categories:** Finance; Research; Education.
- **Website:** `https://paritytrading.app/`
- **Docs:** `https://paritytrading.app/connect/` and the page for that app.
- **Privacy policy:** `https://paritytrading.app/legal/privacy/`
- **Terms:** `https://paritytrading.app/legal/terms/`
- **Support:** `contact@paritytrading.ai`
- **Logo:** `web/public/icon-512.png` (512 by 512 PNG, square). Vector: `web/public/brand/2026-10-21/parity-icon-dark.svg`. OpenAI wants a square image from 48 to 4096 pixels. Anthropic gives no size, so send the 512 PNG.
- **Screenshots:** neither directory needs them for a server with no on-screen widgets. If asked, take them from the three `/connect/<app>/` pages, which carry our own diagrams of each step.

## Tools

Every tool has a `title` and sets `readOnlyHint`, `destructiveHint` (on the two change tools) and `openWorldHint` as true or false (`web/src/lib/mcp/tools.ts`). OpenAI wants all three set on every tool. Add `destructiveHint: false` to the read tools before submitting to OpenAI if its checker asks.

| Tool | Reads or changes | Says |
| --- | --- | --- |
| `verify_trades` | reads | Verify on a trade list or equity curve: verdict, sentence, five cards, tries survived; nothing stored |
| `verify_strategy` | reads | Verify on one of our tested strategies with every try counted, or the closest to a described rule set |
| `verify_claim` | reads | Checks a seller's claim for numbers that are impossible or need more data |
| `search_strategies` | reads | Find tested strategies with their verdict from the 11 tests |
| `get_strategy` | reads | Full results for one strategy |
| `search_leads` | reads | Best variations from the strategy search, with the luck check |
| `list_market_series` | reads | Market series Parity publishes, delayed |
| `get_market_series` | reads | The history of one series |
| `news_impact` | reads | What markets did after kinds of news |
| `list_academy_lessons` | reads | Academy courses and lessons |
| `get_academy_lesson` | reads | One lesson's text and quick check |
| `search`, `fetch` | reads | Search across Parity and fetch one item (ChatGPT deep research) |
| `verify_record`, `verify_description` | reads | Old names for `verify_trades` and `verify_claim`, marked deprecated ([DEC-0082](../decisions/0082-verify-tools-and-endpoints-for-ai-apps-and-programs.md)) |
| `list_demo_accounts` | reads | The person's demo accounts (virtual money) |
| `place_demo_order` | changes, off | Limit or stop order in a demo account |
| `save_trade_layout` | changes, off | Saves a chart layout |

## Safety notes for reviewers

- No real trading, no payments, no money movement. Demo orders use virtual money and delayed prices.
- The two change tools are hidden unless the server switch `MCP_WRITE_ENABLED` is on, and even then run only for an app the person allowed on Parity's Allow page or on `/connect/`. A database rule checks that permission again.
- A connected app's token cannot write to any table directly. Row rules block it.
- Limits: 30 calls a minute, 1000 a day, 30 changes a day per person. Each call is logged without its content and the log is deleted after 90 days.
- Every answer is labelled research and education, not investment advice.

## Test account

Reviewers need an account with data and no two-step sign-in.

1. Sign up at `https://paritytrading.app/signup/` with a new mailbox the owner controls, such as `review@paritytrading.ai`. Do not reuse a personal account.
2. Open Parity Trade and create one demo account so `list_demo_accounts` returns something.
3. Do not turn on two-step sign-in for it. Keep the password in the Keychain and add a row to the credentials register.
4. Give reviewers: the address, the email and password, and this script: "Ask: Check these trades with Parity Verify, I tried 12 settings before this one: 2026-01-05 +120, 2026-01-12 -80, 2026-01-19 +45. Then: Is a 92% win rate with 5% take-profit and no stop possible? Then: Verify the strategy 'The Gambit'. Then: Using Parity, which tested strategies beat the S&P 500?"
5. For OpenAI, also write 5 prompts that should use Parity and 3 that should not (for example a weather question, a recipe, and "buy 10 shares of Apple for me", which Parity must not do).

## Submission steps (owner)

### Anthropic connector directory

1. Sign in to claude.ai on a paid plan (on Team or Enterprise, an owner does this). Open `https://claude.ai/directory/manage` and choose Submit new, then MCP connector.
2. Fill in each step: Connection (the address), Tools (the portal reads them), Listing (name, one line, description, categories, logo), Use cases (the test script), Company, Authentication (OAuth, automatic registration; return address `https://claude.ai/api/mcp/auth_callback`), Data handling (the privacy and safety notes above), Test and launch (the test account), Compliance (seven acknowledgements).
3. Review and submit. The address part of the listing (its slug) cannot change after it goes live.
4. Rules: [submission guide](https://claude.com/docs/connectors/building/submission.md), [review criteria](https://claude.com/docs/connectors/building/review-criteria.md), [directory policy](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy). Questions go to `mcp-review@anthropic.com`.

### OpenAI plugin directory (ChatGPT)

1. Verify the OpenAI organisation (individual or business) in the platform's organisation settings. The person submitting needs the Owner role or apps management write access.
2. Open `https://platform.openai.com/plugins` and start a new submission.
3. Upload a ZIP with the two files below and the logo, then add the privacy, terms, support and website addresses, the 5 good and 3 bad prompts, the test account, and a short screen recording of a chat that uses Parity.
4. Rules: [submission](https://developers.openai.com/plugins/deploy/submission.md), [review](https://developers.openai.com/plugins/deploy/app-review.md), [guidelines](https://developers.openai.com/plugins/plugin-guidelines), [sign-in](https://developers.openai.com/plugins/build/auth.md).

`.mcp.json`:

```json
{ "mcpServers": { "parity": { "type": "http", "url": "https://paritytrading.app/mcp" } } }
```

`plugin.json` (check the current fields in OpenAI's submission guide before uploading):

```json
{
  "name": "Parity",
  "description": "Look up trading strategies tested against the S&P 500, check a trading record for luck, and read market data and lessons. Read only.",
  "website": "https://paritytrading.app/",
  "privacy_policy_url": "https://paritytrading.app/legal/privacy/",
  "terms_url": "https://paritytrading.app/legal/terms/",
  "support_email": "contact@paritytrading.ai"
}
```

### Gemini CLI extensions gallery

There is no form and no review queue ([releasing extensions](https://github.com/google-gemini/gemini-cli/blob/main/docs/extensions/releasing.md), [gallery](https://geminicli.com/extensions/browse/)). Google's crawler lists public GitHub repositories that have the `gemini-cli-extension` topic and a `gemini-extension.json` at their root.

1. Create a new public repository, for example `abasheer-rion/parity-gemini`. Do not use the main repository, since the file must sit at its root.
2. Add `gemini-extension.json`:

   ```json
   {
     "name": "parity",
     "version": "1.0.0",
     "mcpServers": { "parity": { "httpUrl": "https://paritytrading.app/mcp" } }
   }
   ```

3. Add a README that links to `https://paritytrading.app/connect/gemini/`.
4. Add the topic `gemini-cli-extension` in the repository's About settings. It shows in the gallery within a day.

The Gemini app on the web and phone has no way we could confirm in Google's docs to add an outside server, so there is nothing to submit for it.

## Bring your own model

The Assistant panel supports OpenRouter sign-in and Anthropic, OpenAI and Google keys (`web/src/assistant/keys.ts`). It is off for everyone: the repository variable `AI_ASSISTANT` is not set. To turn it on, set `AI_ASSISTANT=on` in the GitHub repository variables and redeploy. Anyone can try it first with `?assistant=on`, for example `https://lab.paritytrading.app/?assistant=on`.

## Sources

- Claude: [custom connectors](https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp), [connector authentication](https://claude.com/docs/connectors/building/authentication.md), [Claude Code MCP](https://code.claude.com/docs/en/mcp), [publishing](https://claude.com/docs/directory/publish.md).
- ChatGPT: [custom MCP servers](https://developers.openai.com/api/docs/guides/custom-mcp-server.md), [plugins quickstart](https://developers.openai.com/plugins/quickstart.md).
- Gemini CLI: [MCP servers](https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md).
- Cursor: [MCP](https://cursor.com/docs/mcp.md), [install links](https://cursor.com/docs/mcp/install-links.md).
- VS Code: [MCP configuration](https://code.visualstudio.com/docs/copilot/reference/mcp-configuration).

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0051: AI apps connect to Parity through a hosted MCP server, and people bring their own model](../decisions/0051-ai-apps-connect-to-parity-through-a-hosted-mcp-server-and-people-bring-their-own-model.md)
<!-- backlinks:end -->
