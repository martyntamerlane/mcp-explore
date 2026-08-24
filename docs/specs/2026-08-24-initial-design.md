# Initial Design — mcp-explore

**Date**: 2026-08-24 (project renamed mcp-explore at repo creation, same day)
**Status**: Agreed (grilling session, all branches resolved)
**Participants**: Martyn + Claude

A web app where a user inputs the URL of their MCP server and the app displays its tools, resources, prompts, and capabilities in a pleasing and simple manner.

## Decision log

| # | Decision | Choice | Rejected alternatives |
|---|----------|--------|----------------------|
| 1 | Audience & hosting | Public, shareable, hosted static site | Personal-only, local tool, team-gated |
| 2 | Connectivity | Browser-direct only; no backend, no proxy | Lambda proxy fallback, proxy-always |
| 3 | Transports | Streamable HTTP, auto-fallback to legacy HTTP+SSE (official SDK) | Streamable-only; stdio bridge (deferred, TODO-3) |
| 4 | Auth | Anonymous + user-pasted custom headers (e.g. bearer) | Full OAuth 2.1 (deferred, TODO-2), anonymous-only |
| 5 | Interactivity scope | Browse catalog + read resource contents | Tool calling (deferred, TODO-1), pure listing |
| 6 | Presentation | Visual graph/map as the primary view | Docs-style master-detail, card grid |
| 7 | Graph model | Graph for navigation + slide-in detail panel for schemas/contents | In-graph expanding nodes, graph+list dual UI (TODO-6) |
| 8 | Graph scale | Flat ring + zoom/pan + search filter | Auto-group by prefix (future, TODO-4), top-N overflow |
| 9 | Monetization | Document only; keep seams clean, build nothing | Entitlement layer now, full product thesis |
| 10 | Stack | React 19 + Vite + **TypeScript**, CSS Modules, official MCP SDK | Plain JS (meal-planner rule — deliberately diverged), Svelte |
| 11 | Deployment | GitHub Pages via GitHub Actions on push to main | S3+CloudFront, Cloudflare Pages |
| 12 | Visual direction | Dark-first dev aesthetic; theme-ready CSS variables | Light docs style, both themes day one (light = TODO-5) |
| 13 | V1 extras | Shareable `?server=` URL, recent-servers list, built-in demo server, raw JSON toggle | — (all four accepted) |

## Architecture consequences

- **Pure static SPA.** No backend at all: no SSRF surface, no cost exposure, visitors' auth tokens never transit our infrastructure. Connections go visitor's-browser → their MCP server.
- **CORS is the compatibility boundary.** Servers without CORS headers are unreachable from the page. Mitigation is a first-class **CORS diagnostic panel**: when a connection fails, tell the developer exactly which headers their server must send. This is a feature, not an apology. (Localhost servers additionally face Chrome's local-network permission prompt.)
- **Untrusted input everywhere.** Everything the connected server returns is attacker-controlled. Escape at render; never `dangerouslySetInnerHTML` with server-derived content; never eval.
- **Deploy = push to main.** Once Pages is live, merging to main publishes. Treat pushes to main as deploys (confirmation rule in CLAUDE.md).

## UI model

```
┌─────────────────────────┬───────────────────┐
│      ⚡ my-server        │ create_issue      │
│     ┌────┬────┐         │ Create a new      │
│  (tools)(res)(prompts)  │ issue.            │
│   ╱ │ ╲       │         │ Arguments         │
│  ●  ◉  ●     ●         │  title  string ✱  │
│     ↑selected           │  body   string    │
│  [zoom] [fit] [search]  │  [pretty | raw]   │
└─────────────────────────┴───────────────────┘
```

- **Landing screen**: URL input + Advanced headers box, recent-servers list (localStorage), "Try the demo" button (built-in in-page simulated server — no network, always works, doubles as a test fixture).
- **Graph**: hand-rolled SVG. Root server node → three category hubs (tools / resources / prompts) → flat ring of leaf nodes per category. **Deterministic polar layout computed once — identical every load. No physics, no draggable nodes** (lesson: meal-planner ISSUE-102). Motion limited to hover/focus transitions and zoom/pan. Search box dims non-matching nodes.
- **Detail panel**: slides in on node click. Human-readable schema rendering (name, description, arguments table with types/required/defaults/enums), resource contents on fetch (text/JSON/images), prompt metadata. Raw-JSON toggle with copy button on every panel.
- **Overview header**: server name, version, capability badges, entity counts.
- **Entity colours**: one accent per entity type (tools / resources / prompts), as CSS custom properties.

## Privacy & security invariants

- Auth headers/tokens **never** appear in URLs (shareable links carry only the server URL; recipients supply their own credentials).
- Tokens stored client-side only (localStorage, opt-out offered), never transmitted anywhere except the user's own MCP server.
- No analytics/telemetry in v1.

## Testing intent

Adapted meal-planner three-tier strategy:
- **Tier 1** — Vitest unit: protocol handling, polar-layout math, URL/state parsing, schema-renderer logic. Run after every change, <5s.
- **Tier 2** — RTL + jsdom component tests: landing flow, graph selection → panel, diagnostics. Before deploys.
- **Tier 3** — Playwright smoke against the built-in demo server (no external network). Before deploys.

## Deferred (tracked in TODO.md)

Tool calling with schema-driven forms (v2 flagship), OAuth 2.1, stdio local bridge, semantic grouping (possible paid feature — would need an entitlement mechanism), light theme, docs-style list view, opt-in CORS proxy.
