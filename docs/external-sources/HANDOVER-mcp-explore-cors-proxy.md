# Handover: CORS Proxy + Public MCP Server Support for mcp-explore

## Context

**mcp-explore** is a personal browser-based MCP (Model Context Protocol) server visualizer hosted on GitHub Pages at `https://martyntamerlane.github.io/mcp-explore`. It connects to remote MCP servers over Streamable HTTP / SSE from the browser and visualizes their tools, resources, and prompts. It is used as a portfolio piece, so polish and observable behavior matter.

**Problem:** Many public MCP servers don't send CORS headers permitting a GitHub Pages origin, so browser fetches fail at preflight even though the endpoints work fine via curl. Docs-oriented servers (e.g. DeepWiki) are permissive; others (e.g. Shopify Storefront) may not be.

**Solution (already decided — do not redesign):**
1. A small Cloudflare Worker CORS proxy on the free plan, locked down with a target-host allowlist and origin check.
2. Client-side changes in mcp-explore: direct connection first, automatic fallback through the proxy on CORS failure, with a visible "retrying via proxy" state in the UI.
3. A curated set of known-good public MCP endpoints preloaded in the UI for demos.

## Deliverable 1: Cloudflare Worker proxy

New repo/directory `mcp-proxy` (Wrangler project, JavaScript, Worker only — no Pages, no KV, no Durable Objects).

### Requirements

- Accepts requests at `/?target=<url-encoded MCP endpoint URL>`.
- Forwards method, body, and MCP-relevant headers to the target. Pass through at minimum: `Content-Type`, `Accept`, `Mcp-Session-Id`, `MCP-Protocol-Version`, `Last-Event-ID`, `Authorization` (forward only — never log or store).
- **Streams** the upstream response body (pass `upstream.body` straight through). Do NOT buffer — SSE responses must stream or they hang.
- Handles `OPTIONS` preflight directly (204/200 with CORS headers, no upstream call).
- CORS response headers:
  - `Access-Control-Allow-Origin: https://martyntamerlane.github.io` (exact origin, not `*`)
  - `Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS`
  - `Access-Control-Allow-Headers: Content-Type, Accept, Authorization, Mcp-Session-Id, MCP-Protocol-Version, Last-Event-ID`
  - `Access-Control-Expose-Headers: Mcp-Session-Id` — **mandatory**; browsers hide this response header by default and the MCP client cannot continue the session after `initialize` without it (see the Streamable HTTP transport section of the MCP spec at modelcontextprotocol.io/specification).
- **Target-host allowlist** (security-critical, this is not optional): reject any `target` whose host is not in a hardcoded allowlist. Return 403 with a JSON error body. Initial allowlist:
  - `mcp.deepwiki.com`
  - `knowledge-mcp.global.api.aws`
  - `huggingface.co`
  - `*.myshopify.com` (suffix match on `.myshopify.com` for Shopify Storefront endpoints)
  - `learn.microsoft.com`
- **Origin check**: reject requests where the `Origin` header is present and is neither `https://martyntamerlane.github.io` nor `http://localhost:*` (allow localhost for dev). Known to be spoofable; it's a scraper filter, not a security boundary.
- Reject `target` values that are not valid `https://` URLs.
- No logging of request bodies or Authorization headers.
- Add a `GET /health` route returning 200 JSON (used by the client to detect proxy availability).

### Local dev + deploy

- Environment: Windows laptop, Ubuntu 20.04 under WSL2. Node must come from nvm (apt Node on 20.04 is too old for Wrangler; Wrangler needs Node 18+).
- `wrangler dev` on `localhost:8787` for local testing; `npx wrangler deploy` to publish. First `wrangler login` in WSL may fail to open a browser — print the URL and paste it into the Windows browser manually.
- Free plan only. Do not attach billing, do not add paid features. Free plan = 100k requests/day hard cap; over-limit requests fail with an error, there are no overage charges.

### Verification (must pass before moving to Deliverable 2)

```bash
# 1. Preflight
curl -i -X OPTIONS "http://localhost:8787/?target=https%3A%2F%2Fmcp.deepwiki.com%2Fmcp" \
  -H "Origin: https://martyntamerlane.github.io" \
  -H "Access-Control-Request-Method: POST"
# Expect: CORS headers present, incl. Access-Control-Expose-Headers: Mcp-Session-Id

# 2. MCP initialize through the proxy
curl -X POST "http://localhost:8787/?target=https%3A%2F%2Fmcp.deepwiki.com%2Fmcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
# Expect: valid initialize result from DeepWiki

# 3. Allowlist rejection
curl -i "http://localhost:8787/?target=https%3A%2F%2Fexample.com%2Fmcp"
# Expect: 403

# 4. tools/list end-to-end (initialize, capture Mcp-Session-Id from response headers, then tools/list with it)
```

## Deliverable 2: mcp-explore client changes

Work in the existing mcp-explore repo. Inspect the current connection code first and follow its existing patterns — do not restructure the app.

1. **Config**: add the deployed proxy base URL as a constant/config value (leave a `TODO` placeholder if the Worker isn't deployed yet; wire the real URL after `wrangler deploy`).
2. **Connection strategy**: attempt direct connection to the entered MCP URL first. If the fetch fails in a way consistent with CORS (opaque `TypeError: Failed to fetch` on a request that never reached the network response stage), retry the same request sequence through the proxy (`{proxyBase}/?target={encodeURIComponent(url)}`).
   - Note: browsers do not expose "this was CORS" explicitly; a network-level `TypeError` from `fetch` is the detection signal. Do not fall back on HTTP error statuses (4xx/5xx reached the server — those are real errors, surface them).
   - Remember the working mode per server for the rest of the session so every request doesn't re-attempt direct first.
3. **UI states**: connection indicator should distinguish: `connecting (direct)` → `direct failed, retrying via proxy` → `connected (direct)` / `connected (via proxy)` / `failed`. The "retrying via proxy" transition should be visible, not instant/silent — this is a deliberate portfolio detail.
4. **Session handling**: ensure the client reads `Mcp-Session-Id` from response headers and replays it on subsequent requests in both direct and proxied modes.
5. **Preset server list**: add a dropdown/quick-pick of known-good public endpoints so demos are one click:
   - DeepWiki — `https://mcp.deepwiki.com/mcp` (no auth)
   - AWS Knowledge — `https://knowledge-mcp.global.api.aws` (no auth)
   - Hugging Face — `https://huggingface.co/mcp` (no auth for public tools)
   - Shopify Storefront — `https://{shop}.myshopify.com/api/mcp` (no auth; prompt for the shop domain)
   - Microsoft Learn — `https://learn.microsoft.com/api/mcp` (verify it responds before including; drop if not)
6. **Error surfacing**: if both direct and proxy fail, show the proxy's error body when available (e.g. the 403 allowlist message) rather than a generic failure.

## Constraints & conventions

- Keep the Worker a single small file; no framework, no dependencies beyond what `npm create cloudflare` scaffolds.
- Match the existing code style of mcp-explore for client changes.
- Do not add analytics, logging services, or any paid Cloudflare features.
- Do not commit any tokens or the Cloudflare account ID beyond what `wrangler.toml` requires.
- Public repo hygiene: this is portfolio code — clear naming, a short README section in each repo explaining the CORS problem and the fallback design.

## Definition of done

- [ ] Worker deployed to `*.workers.dev`, all four curl verifications pass against the deployed URL
- [ ] Allowlist + origin check + `/health` in place; SSE responses stream (verify with a long-running `tools/call` if available, or confirm no buffering in code review)
- [ ] mcp-explore falls back to proxy automatically on CORS failure with visible UI state
- [ ] All preset servers connect from the live GitHub Pages site (direct or via proxy)
- [ ] README updated in both repos (mcp-explore: one paragraph on the proxy fallback; mcp-proxy: setup, allowlist policy, and why it isn't an open proxy)
- [ ] WAF rate-limiting rule deliberately deferred — noted in mcp-proxy README as a follow-up if quota alerts appear
