---
id: GDE-0006
title: Connecting AI tools to Parity with MCP
type: guide
status: current
created: 2026-10-23
updated: 2026-10-25
authors: [ayan]
tags: [process]
related: [DEC-0025, DEC-0014, DEC-0051]
---

# Connecting AI tools to Parity with MCP

## In plain words

Parity has a small local server, `parity mcp`, that gives AI assistants Parity tools: backtests, the gauntlet, the search's leads, data, scenarios, news and the docs ([DEC-0025](../decisions/0025-ai-assistants-get-parity-tools-through-a-local-mcp-server.md)). You sign in to your own AI tool as usual. This guide shows how to point each tool at the server. It takes two minutes.

Everything the assistant tries is counted toward the luck check, so ask it for a few well-reasoned ideas, not hundreds. Results are research only, not investment advice.

## Summary

- Install once: `python3 -m venv engine/.venv && engine/.venv/bin/pip install -e "engine[mcp]"`.
- The server is `<repo>/engine/.venv/bin/parity mcp`, where `<repo>` is the full path to your checkout, for example `/Users/you/Projects/parity`.
- Cursor and VS Code pick it up from the committed `.cursor/mcp.json` and `.vscode/mcp.json` when you open the repo.
- Claude Code, Claude Desktop, Gemini CLI and Codex CLI need one line or one block of config, below.
- ChatGPT, and anyone without the repo, can use the hosted server at `https://paritytrading.app/mcp` instead. It signs you in with Parity and has fewer tools (no backtests). Setup for each app is on the site at `/connect/`; how it works is in [DEC-0051](../decisions/0051-ai-apps-connect-to-parity-through-a-hosted-mcp-server-and-people-bring-their-own-model.md).

## Install

From the repo root:

```sh
python3 -m venv engine/.venv
engine/.venv/bin/pip install -e "engine[mcp]"
engine/.venv/bin/parity fetch            # the data cache, if you have not already
engine/.venv/bin/parity run --quick      # optional: strategy numbers for list_strategies
```

Check it starts. It waits silently for an AI tool to talk to it, so press Ctrl-C to stop:

```sh
engine/.venv/bin/parity mcp
```

## Claude Code

One line, run anywhere:

```sh
claude mcp add parity -- <repo>/engine/.venv/bin/parity mcp
```

That adds it for the current project. Add `--scope user` after `add` to have it in every project. Check with `claude mcp list`, or `/mcp` inside a session.

## Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (on Windows, `%APPDATA%\Claude\claude_desktop_config.json`), then restart Claude Desktop:

```json
{
  "mcpServers": {
    "parity": {
      "command": "<repo>/engine/.venv/bin/parity",
      "args": ["mcp"]
    }
  }
}
```

Claude Desktop needs the full path, not `~`.

## Cursor

The repo commits `.cursor/mcp.json`, so opening the repo is enough. Turn the server on in Cursor Settings, under MCP. The file uses Cursor's `${workspaceFolder}` variable, so it works wherever the repo is:

```json
{
  "mcpServers": {
    "parity": {
      "command": "${workspaceFolder}/engine/.venv/bin/parity",
      "args": ["mcp"]
    }
  }
}
```

## VS Code

The repo commits `.vscode/mcp.json`. Open the repo, open that file and click Start above the server, or run "MCP: List Servers". Copilot Chat in agent mode then shows the Parity tools:

```json
{
  "servers": {
    "parity": {
      "type": "stdio",
      "command": "${workspaceFolder}/engine/.venv/bin/parity",
      "args": ["mcp"]
    }
  }
}
```

## Gemini CLI

Add this to `~/.gemini/settings.json`, or to `.gemini/settings.json` in the repo for this project only. The timeout is in milliseconds and gives a gauntlet room to finish:

```json
{
  "mcpServers": {
    "parity": {
      "command": "<repo>/engine/.venv/bin/parity",
      "args": ["mcp"],
      "timeout": 300000
    }
  }
}
```

Check with `/mcp` inside Gemini CLI.

## OpenAI Codex CLI

One line:

```sh
codex mcp add parity -- <repo>/engine/.venv/bin/parity mcp
```

Or add this to `~/.codex/config.toml`. Codex stops a tool call after 60 seconds by default, which is too short for a gauntlet:

```toml
[mcp_servers.parity]
command = "<repo>/engine/.venv/bin/parity"
args = ["mcp"]
tool_timeout_sec = 300
```

## ChatGPT (phase 2)

ChatGPT connects only to MCP servers on the internet, over HTTPS. That needs the hosted version: the same tools behind a Parity sign-in, on its own subdomain behind a Cloudflare tunnel, with a cap on compute per person and a log. It is planned, not built.

## Using it

Ask the assistant to use the `refine-strategy` prompt (in Claude Code, type `/` and pick it), or just describe an idea:

> Use the Parity tools. I think currency carry works better when the VIX is calm. Test it with a few specs and tell me if it survives the luck check.

Good habits, which the prompt also asks for:

- State the reason an idea should work before testing it.
- Read the look-ahead check first. If it fails, nothing else matters.
- A deflated Sharpe of 0.95 or more passes the luck check. Most ideas fail it.
- Check that `breakeven_bps` is well above 1 and that the Sharpe at double cost is still positive.
- Change one thing per try. Every try raises the bar.

A promising idea ends as a draft in `engine/output/mcp_drafts/`. A human reads it, pastes it into the factory, and opens a pull request. Only a registration and an official run make it a result.

## Limits and settings

| Setting | Default | Environment variable |
|---|---|---|
| Seconds before a backtest or spec stops | 90 (gauntlet 270) | `PARITY_MCP_TIMEOUT` |
| Specs per minute | 20 | `PARITY_MCP_SPECS_PER_MINUTE` |
| Backtests and gauntlets per minute | 6 | `PARITY_MCP_RUNS_PER_MINUTE` |
| Data folder | `engine/data` | `PARITY_DATA_DIR` |
| Output folder (log, drafts, latest.json) | `engine/output` | `PARITY_OUTPUT_DIR` |
| Trial database | `engine/output/search.db` | `PARITY_SEARCH_DB` |

Set them in the `env` block of the tool's config if you need to. Every call is logged to `engine/output/mcp.log`.

## When it does not work

- **No tools show up.** Run `<repo>/engine/.venv/bin/parity mcp` in a terminal. If it says the MCP extra is missing, install it as above.
- **"No cached data".** Run `engine/.venv/bin/parity fetch`.
- **A gauntlet times out in the AI tool.** Raise that tool's timeout as shown above.
- **"limit reached".** Wait a minute. The cap is there to keep tries few and deliberate.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0025: AI assistants get Parity tools through a local MCP server](../decisions/0025-ai-assistants-get-parity-tools-through-a-local-mcp-server.md)
- [DEC-0051: AI apps connect to Parity through a hosted MCP server, and people bring their own model](../decisions/0051-ai-apps-connect-to-parity-through-a-hosted-mcp-server-and-people-bring-their-own-model.md)
- [RES-0024: AI apps connecting to Parity, and bringing your own model](../research/0024-ai-apps-connecting-to-parity-and-bringing-your-own-model.md)
- [REF-0027: Going live with real trading](../reference/0027-going-live-with-real-trading.md)
- [LOG-0019: Work log for 24 and 25 October](../log/2026-10-25-work-log-for-24-and-25-october.md)
<!-- backlinks:end -->
