---
id: DEC-0025
title: AI assistants get Parity tools through a local MCP server
type: decision
status: accepted
created: 2026-10-23
updated: 2026-10-23
authors: [ayan]
tags: [method, process, strategy]
related: [DEC-0014, DEC-0009, DEC-0007, GDE-0006, REF-0006]
---

# AI assistants get Parity tools through a local MCP server

## In plain words

The owner wanted AI models (Claude, OpenAI, Gemini and Cursor's) to help refine trading algorithms and read Parity's data from inside code editors and terminals.

Phase 1 is a small local server, `parity mcp`. It speaks the Model Context Protocol (MCP), the standard way AI tools plug in outside tools. Each person signs in to their own AI tool, with their own account and bill. Our server only adds Parity tools. It runs on the person's own machine, reads the repo's data and never goes online.

The assistant can list and backtest strategies, run the gauntlet, try new strategy ideas, read the search's best leads, look at data, scenarios, news and the docs, and write a draft recipe for a human to review.

Every idea the assistant tries counts as a trial. That raises the bar of the luck check for everyone, exactly as the always-on search's tries do ([DEC-0014](0014-a-strategy-factory-and-an-always-on-search.md)). So an assistant that tries hundreds of ideas cannot manufacture a winner.

Setup for each AI tool is in [GDE-0006](../guides/0006-connecting-ai-tools-to-parity-with-mcp.md).

## Context

The research loop is: state an idea, write it as a spec, backtest it, check the luck check and costs, and repeat. AI assistants are good at that loop and bad at stopping. An assistant left alone will tune settings until something looks good, which is overfitting.

The factory and the search ([DEC-0014](0014-a-strategy-factory-and-an-always-on-search.md)) already describe any strategy as a small spec. They also count every variation as a trial. That makes the spec the natural thing for an assistant to write.

We wanted one server for every AI tool, not one integration per vendor. MCP is supported by Claude Code, Claude Desktop, Cursor, VS Code, Gemini CLI and OpenAI's Codex CLI. ChatGPT supports it only for servers on the internet.

## Decision

1. **A local server over standard input and output.** `engine/src/parity/mcp_server.py` uses the official MCP Python SDK (FastMCP). It installs as an extra, `pip install -e "engine[mcp]"`, and starts with `parity mcp`. The SDK is pinned below version 2, which renames FastMCP.
2. **Tools.** Each has a plain description for the assistant and returns short JSON: summaries, with long series cut down to at most a few hundred points.
   - `list_strategies` and `get_strategy`: names, plain names, tags, the gauntlet verdict, key numbers, settings, the reference doc and weaknesses, from the latest report.
   - `run_backtest` and `run_gauntlet`: one strategy, optionally with changed settings.
   - `spec_options` and `evaluate_spec`: the spec format, and the main loop. `evaluate_spec` builds any search-style spec, backtests it, and returns its numbers, Sharpe at double costs, the look-ahead check and the luck check.
   - `search_leads`: the best variations in `search.db`, with the luck check recomputed.
   - `list_series` and `get_series`: catalog data with each provider's licence.
   - `scenario_analogues` and `news_impact`: past events like a scenario, and market moves after stored headlines.
   - `glossary`, `search_docs` and `read_doc`: the plain-words sections of our docs.
   - `draft_recipe`: writes a proposed factory recipe to `engine/output/mcp_drafts/<name>.py`, with the steps a human follows to promote it.
3. **Resources and a prompt.** Key decisions and the gauntlet reference are exposed as MCP resources. Any doc can be read as `parity://doc/<ID>`. A prompt called `refine-strategy` walks the assistant through a disciplined loop:
   - state a hypothesis;
   - check what was already tried;
   - write one spec;
   - read the look-ahead check, the luck check and the costs;
   - change one thing at a time, and stop after about five tries.
4. **The assistant's tries are counted.** Each distinct spec, or changed setting of a named strategy, is stored in `search.db` in its own table, `mcp_trials`, marked `source=mcp`. Trying the same spec again is not a new trial. The luck check (deflated Sharpe, [DEC-0009](0009-excess-returns-financed-leverage-frozen-code.md)) is recomputed over the search's trials and the assistant's together. The search's own table and code are untouched.
5. **Safety, enforced in code.**
   - Read-only on the repo. The only writes are the drafts folder, a call log (`engine/output/mcp.log`) and the trial table. A path check refuses anything else, and always refuses `ledger/` and `registrations/`.
   - No tool starts an official run ([DEC-0007](0007-official-results-come-only-from-the-ledger.md)). Drafts are never registered.
   - Each compute call has a timeout: 90 seconds by default, 270 for a gauntlet. Calls run one at a time.
   - Each minute allows at most 20 specs and 6 backtests or gauntlets.
   - Every result carries "Research only, not investment advice."
   - A spec that almost never invests is rejected, as the search does, because sitting in cash fakes a high Sharpe.
6. **Built for phase 2.** The tools are plain methods on one class, `ParityTools`. A hosted server can wrap the same class over HTTP behind a Parity sign-in, for ChatGPT and for people without the repo. A one-click VS Code and Cursor extension can then point at either server. Neither is built yet.

## Consequences

- An assistant's tries make the luck check stricter for everything in `search.db`. The search's dashboard export does not yet include the assistant's trials. That needs a small change in `search.py`, left for when the search work there settles.
- The server reads `engine/output/latest.json` for strategy numbers. Without it, `list_strategies` runs a quick backtest of every strategy, which takes about a minute.
- Results depend on the local data cache. A fresh `parity fetch` changes them, as it does for every other run.
- Hosting the server publicly (phase 2) will need a sign-in, a cap on compute per person and a log, on its own subdomain behind a Cloudflare tunnel.
- Each AI tool has its own default timeout for a tool call. Gauntlets can take longer than the shortest of them; the guide shows where to raise it.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [INT-0003: Parity Verify, the lie detector for trading strategies and bots](../intent/0003-parity-verify-the-lie-detector-for-trading-strategies-and-bots.md)
- [DEC-0021: Dark only, no top bar, computed findings and a large scale sim](0021-dark-only-no-top-bar-computed-findings-and-a-large-scale-sim.md)
- [DEC-0032: Parity Verify as a data and API business, with a free retail tier](0032-parity-verify-as-a-data-and-api-business-with-a-free-retail-tier.md)
- [GDE-0006: Connecting AI tools to Parity with MCP](../guides/0006-connecting-ai-tools-to-parity-with-mcp.md)
- [REF-0016: Parity Verify MVP spec](../reference/0016-parity-verify-mvp-spec.md)
<!-- backlinks:end -->
