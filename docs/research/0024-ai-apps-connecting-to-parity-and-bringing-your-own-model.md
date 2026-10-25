---
id: RES-0024
title: AI apps connecting to Parity, and bringing your own model
type: research
status: current
created: 2026-10-25
updated: 2026-10-25
authors: [ayan]
tags: [infra, process]
related: [DEC-0051, DEC-0025, GDE-0006]
---

# AI apps connecting to Parity, and bringing your own model

## In plain words

Parity has no AI model of its own. The owner asked how people can use the AI they already pay for with Parity. There are two directions. In the first, an AI app such as Claude or ChatGPT connects to Parity and calls our tools; that needs a public server that speaks the Model Context Protocol (MCP) and a sign-in that follows the MCP rules. In the second, Parity calls the person's own model from inside our apps; that needs either a sign-in the model company offers to outside apps, or the person's own key. This note records what exists in October 2026, with sources, and what we could not confirm. The choices we made are in [DEC-0051](../decisions/0051-ai-apps-connect-to-parity-through-a-hosted-mcp-server-and-people-bring-their-own-model.md).

## Summary

- The current MCP version is 2026-07-28. A remote server must publish where to sign in (Protected Resource Metadata) and must check every token. Sign-in is OAuth 2.1 with PKCE.
- In 2026-07-28 the transport changed: no handshake, no sessions, every request carries headers that must match its body. Older apps still use the 2025 versions with a handshake, so a server should speak both.
- Supabase Auth, which Parity already uses, can act as the OAuth server for MCP apps (beta, all plans). It supports dynamic client registration and PKCE, but only the scopes openid, email, profile and phone.
- Claude (web, desktop, mobile, Claude Code), ChatGPT, Gemini CLI, Cursor, VS Code, Codex and Copilot Studio can all add a remote MCP server with OAuth.
- For bringing your own model, only OpenRouter offers an open OAuth sign-in that gives an app a key on the person's own bill, with no app registration. Hugging Face has one too, but it needs a registered app.
- OpenAI's "Sign in with ChatGPT" is a limited trial with a waitlist. Anthropic does not allow outside apps to use Claude subscriptions. Google's Gemini API has OAuth, but it needs a Google Cloud app, and who pays is not documented.
- Every major provider's API accepts calls straight from a browser, so a key can stay in the browser and never touch our servers.

## The MCP sign-in rules

The authorization part of the spec [1] says:

- The server must publish Protected Resource Metadata (RFC 9728) and point to it from a 401 answer's `WWW-Authenticate` header or a well-known address [2].
- Apps must send the `resource` parameter (RFC 8707) and must use PKCE with S256. They must stop if the sign-in server does not list `code_challenge_methods_supported` [3].
- Apps register in this order: a client id the app already has, a Client ID Metadata Document (recommended), then Dynamic Client Registration, which the spec now marks as deprecated but still allowed [4].
- The server must check the token's audience, and must not pass the token on to other services.

The Streamable HTTP transport in 2026-07-28 [5]:

- One endpoint takes POST. Each request gets a JSON answer or a stream scoped to that request.
- GET streams and `Mcp-Session-Id` sessions are gone. A server that only speaks the new version answers GET and DELETE with 405.
- Every POST carries `MCP-Protocol-Version`, `Mcp-Method` and, for tool calls, `Mcp-Name`. A mismatch with the body gets 400 with error -32020.
- A present but unexpected `Origin` header must be refused with 403.

Versioning [6] adds `server/discover` in place of the handshake and error -32022 for an unsupported version. A server may serve old apps (which start with `initialize`) and new ones on the same endpoint [7].

## Supabase as the sign-in server

- Supabase's OAuth 2.1 server is in beta on all plans. It is switched on in the dashboard, and the owner sets an authorization path for the consent page, relative to the site address [8].
- It issues authorization codes with PKCE and refresh tokens. Only openid, email, profile and phone scopes exist; custom scopes are not supported [9].
- Its access tokens are ordinary Supabase tokens with a `client_id` claim. Row level security applies, and policies can read `auth.jwt() ->> 'client_id'` [10]. Supabase's own MCP guide follows the same pattern: switch it on, build the consent page, point MCP apps at `/auth/v1` [11].
- The consent page calls `supabase.auth.oauth.getAuthorizationDetails`, `approveAuthorization` and `denyAuthorization`. supabase-js 2.118, which Parity uses, has these plus `listGrants` and `revokeGrant`.
- Not confirmed: whether it accepts the `resource` parameter or Client ID Metadata Documents. The token's audience is `authenticated`, not our server's address, unless an access token hook changes it.
- On 2026-10-25 the project's metadata address answered "OAuth server is disabled", so it is not switched on yet.

Cloudflare's alternative is its own OAuth library for Workers [12] with the stateless `createMcpHandler` [13]. It would make our server its own sign-in server, with tokens stored in KV. It could not act as the person in the database without holding their Supabase session, so we did not use it.

## What each AI app supports

- **Claude**: custom connectors on Free (one), Pro, Max, Team and Enterprise, from claude.ai, Desktop and mobile. Connections come from Anthropic's servers [14]. The callback is `https://claude.ai/api/mcp/auth_callback`; it supports dynamic registration and metadata documents, always uses S256 and needs a 401 to start sign-in [15].
- **Claude Code**: `claude mcp add --transport http <name> <url>`, then sign in with `/mcp` [16].
- **ChatGPT**: supports metadata documents (preferred) and dynamic registration, requires S256, and asks before tools that change things [17] [18]. Which plans can add custom connectors could not be confirmed.
- **Gemini CLI**: an `httpUrl` setting with automatic OAuth discovery and dynamic registration [19]. Whether the Gemini app itself takes remote MCP servers could not be confirmed.
- **Cursor** [20], **VS Code** [21], **Codex** [22] and **Copilot Studio** [23] all take a remote server with OAuth.

## Bringing your own model

- **OpenRouter**: send the person to `https://openrouter.ai/auth` with a callback and a PKCE challenge, then swap the code at `/api/v1/auth/keys` for a key the person owns [24]. No app registration is documented. Tool calling works across its models [25]. Its API accepted a browser preflight from any origin in our test.
- **OpenAI**: "Sign in with ChatGPT" is a limited trial for chosen partners, with a waitlist [26]. On websites it gives identity only. Paying through the person's ChatGPT plan is a preview for open-source and locally run apps [27]. So for Parity it is an API key.
- **Anthropic**: outside apps may not offer Claude.ai sign-in or use Free, Pro or Max plan credentials [28]. API keys work, and the API allows browser calls with the `anthropic-dangerous-direct-browser-access` header [29].
- **Google Gemini API**: OAuth exists with the `generative-language.retriever` and `cloud-platform` scopes [30], but it needs a Google Cloud OAuth app, and who pays for calls made with a user's OAuth token is not documented [31]. So for Parity it is an API key.
- **Hugging Face**: OAuth with an `inference-api` scope lets an app call Inference Providers on the person's account, billed to them [32] [33]. It needs a registered OAuth app, so it is an owner step if we want it.
- **GitHub Models** was retired on 2026-07-30 [34]. **Puter** offers a "user pays" model through its own sign-in [35].

## Sources

1. [MCP authorization, latest](https://modelcontextprotocol.io/specification/latest/basic/authorization)
2. [MCP authorization server discovery](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/authorization-server-discovery)
3. [MCP security considerations](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/security-considerations)
4. [MCP client registration](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/client-registration)
5. [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
6. [MCP versioning](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning)
7. [MCP server/discover](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
8. [Supabase OAuth server, getting started](https://supabase.com/docs/guides/auth/oauth-server/getting-started)
9. [Supabase OAuth flows](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows)
10. [Supabase OAuth token security](https://supabase.com/docs/guides/auth/oauth-server/token-security)
11. [Supabase MCP authentication](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication)
12. [Cloudflare workers-oauth-provider](https://github.com/cloudflare/workers-oauth-provider)
13. [Cloudflare MCP transport](https://developers.cloudflare.com/agents/model-context-protocol/transport/)
14. [Claude custom connectors](https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp)
15. [Claude connector authentication](https://claude.com/docs/connectors/building/authentication)
16. [Claude Code MCP](https://code.claude.com/docs/en/mcp)
17. [ChatGPT apps authentication](https://developers.openai.com/apps-sdk/build/auth)
18. [ChatGPT apps MCP server](https://developers.openai.com/apps-sdk/build/mcp-server)
19. [Gemini CLI MCP servers](https://geminicli.com/docs/tools/mcp-server/)
20. [Cursor MCP](https://cursor.com/docs/context/mcp)
21. [VS Code MCP](https://code.visualstudio.com/api/extension-guides/ai/mcp)
22. [Codex MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)
23. [Copilot Studio MCP](https://learn.microsoft.com/en-us/microsoft-copilot-studio/mcp-add-existing-server-to-agent)
24. [OpenRouter OAuth PKCE](https://openrouter.ai/docs/guides/overview/auth/oauth)
25. [OpenRouter tool calling](https://openrouter.ai/docs/guides/features/tool-calling)
26. [Sign in with ChatGPT, request a client id](https://developers.openai.com/siwc/request-client-id)
27. [Sign in with ChatGPT, token sharing for open-source apps](https://developers.openai.com/siwc/token-sharing-open-source)
28. [Claude Code legal and compliance](https://code.claude.com/docs/en/legal-and-compliance)
29. [Anthropic TypeScript SDK](https://github.com/anthropics/anthropic-sdk-typescript)
30. [Gemini API OAuth](https://ai.google.dev/gemini-api/docs/oauth)
31. [Google Cloud quota project](https://docs.cloud.google.com/docs/quotas/quota-project)
32. [Hugging Face OAuth](https://huggingface.co/docs/hub/oauth)
33. [Hugging Face Inference Providers pricing](https://huggingface.co/docs/inference-providers/pricing)
34. [GitHub Models](https://docs.github.com/en/github-models/use-github-models/prototyping-with-ai-models)
35. [Puter user-pays model](https://docs.puter.com/user-pays-model/)

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0051: AI apps connect to Parity through a hosted MCP server, and people bring their own model](../decisions/0051-ai-apps-connect-to-parity-through-a-hosted-mcp-server-and-people-bring-their-own-model.md)
- [LOG-0019: Work log for 24 and 25 October](../log/2026-10-25-work-log-for-24-and-25-october.md)
<!-- backlinks:end -->
