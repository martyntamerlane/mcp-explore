# Architecture Overview — mcp-explore

> **Status**: Designed, not yet built. Topology below is the agreed design (see [`docs/specs/2026-08-24-initial-design.md`](specs/2026-08-24-initial-design.md)). Once code exists, this file must document reality — project structure, module map, state shape — updated in the same change as the code.

## Topology

```
visitor's browser ──(Streamable HTTP / legacy SSE, fetch/EventSource)──▶ user's MCP server
        ▲
        │ static assets only
GitHub Pages (Vite build, deployed by GitHub Actions on push to main)
```

- **Zero backend.** The site is static files. All MCP connections originate from the visitor's browser; their tokens never touch our infrastructure and there is no SSRF surface.
- **CORS boundary**: the target MCP server must send CORS headers to be reachable. Connection failures produce a diagnostic panel. Localhost targets additionally face Chrome's local-network-access permission prompt.

## Stack

React 19 + Vite + TypeScript, CSS Modules, `@modelcontextprotocol/sdk` (browser client), hand-rolled SVG graph (computed polar layout, no graph/physics libraries), Vitest + RTL + Playwright.

## State & storage

- App state: React Context + hooks. No external state libraries.
- localStorage: recent servers; optionally their headers (user can decline storing tokens).
- URL query string: `?server=…` only — never headers/tokens.

## Project structure

```
index.html            Vite entry
src/
  main.tsx            React bootstrap
  App.tsx             Placeholder proof harness (replaced by the graph UI plan)
  App.module.css      CSS module for App component
  App.test.tsx        Tests for App component
  global.css          Dark-first CSS custom properties (placeholder palette)
  test-setup.ts       Test environment configuration
  vite-env.d.ts       Vite environment types
  mcp/
    types.ts          ServerSnapshot / Connection / TransportKind
    connect.ts        snapshotClient, connectDemo, connectUrl (streamable→SSE fallback)
    connect.test.ts   Tests for connect module
    demo/
      demoServer.ts   Built-in in-page McpServer (demo-issue-tracker), test fixture
      demoServer.test.ts Tests for demoServer
```

Tests are colocated (`*.test.ts[x]`), run by Vitest (jsdom, globals).

## Deployment

GitHub Pages via a GitHub Actions workflow: build Vite on push to main, publish. Pushing to main is therefore a deploy (see CLAUDE.md). Releases are logged in `DEPLOYMENTS.md`.
