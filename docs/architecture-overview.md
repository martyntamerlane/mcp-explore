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
  App.tsx             Top-level composition: idle/connected phases, ?server= URL sync
  App.module.css      CSS module for App component
  App.test.tsx        Tests for App component
  global.css          Dark-first CSS custom properties (visual identity tokens)
  test-setup.ts       Test environment configuration
  vite-env.d.ts       Vite environment types
  mcp/
    types.ts          ServerSnapshot / Connection / TransportKind
    connect.ts        snapshotClient, connectDemo, connectUrl (streamable→SSE fallback)
    connect.test.ts   Tests for connect module
    demo/
      demoServer.ts   Built-in in-page McpServer (demo-issue-tracker), test fixture
      demoServer.test.ts  Tests for demoServer
  ui/
    ConnectScreen.tsx      Landing screen: URL input, headers disclosure, recents, demo button
    ConnectError.tsx       Connect-failure diagnostics (CORS hints, per-transport detail)
    recents.ts             localStorage recent-servers list (opt-in header persistence)
    Graph.tsx              SVG capability graph: polar layout, zoom/pan, search-dim, selection
    layout.ts              computeLayout — deterministic polar layout math (no physics)
    DetailPanel.tsx         Slide-in panel: schema table, resource contents, raw-JSON disclosure
    schema.ts               JSON Schema → argument table rows for DetailPanel
    *.module.css            CSS modules for each ui/ component
    *.test.ts[x]            Colocated tests for each ui/ module
  dune/
    main.tsx               Independent bootstrap: mounts DuneOverlay into its own React root
    DuneOverlay.tsx         Konami trigger, localStorage persistence, click-to-transition orchestration
    konami.ts               Deterministic rolling-buffer Konami-sequence detector
    HeighlinerScene.tsx     Landing background: heighliner, rotating entity, orbit ring, ship departure
    OrbitTile.tsx           One procedural generative-art tile (5 motifs, palette-rotated)
    shipGenerator.ts        generateShip(seed) — deterministic hash+PRNG ship design from a URL
    ShipSvg.tsx             Renders a ship design as SVG
    theme.css               :root[data-theme="dune"] token overrides (see spec, 2026-08-24-dune-mode-design.md)
    *.module.css, *.test.ts[x]   CSS modules and colocated tests
```

**Dune mode's isolation** (see [`docs/specs/2026-08-24-dune-mode-design.md`](specs/2026-08-24-dune-mode-design.md)): `src/dune/` shares no files, imports, or component coupling with the rest of `src/`. It is loaded via a second, independent `<script type="module" src="/src/dune/main.tsx">` entry in `index.html` — the only file outside `src/dune/` the feature touches, by exactly one added line. It reaches the rest of the page only through generic `document`-level DOM observation (`keydown`, capture-phase `click`), never `preventDefault`/`stopPropagation`, and reskins the whole app purely via a second CSS token block cascading over the same `var(--…)` custom properties every component already uses. This was a deliberate choice to allow it to be built concurrently with other work touching `App.tsx`/`global.css`/`ConnectScreen.tsx`/`Graph.tsx` without merge risk.

Tests are colocated (`*.test.ts[x]`), run by Vitest (jsdom, globals).

## Deployment

GitHub Pages via a GitHub Actions workflow: build Vite on push to main, publish. Pushing to main is therefore a deploy (see CLAUDE.md). Releases are logged in `DEPLOYMENTS.md`.
