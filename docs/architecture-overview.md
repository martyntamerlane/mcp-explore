# Architecture Overview — mcp-explore

> **Status**: Built (v1 UI 2026-08-25; flow view same day, see [`docs/specs/2026-08-25-flow-view-design.md`](specs/2026-08-25-flow-view-design.md)). This file documents reality — project structure, module map, state shape — updated in the same change as the code.

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

React 19 + Vite + TypeScript, CSS Modules, `@modelcontextprotocol/sdk` (browser client), hand-rolled flow diagram (HTML pills + DOM-measured SVG traces, deterministic, no graph/physics libraries), Vitest + RTL + Playwright.

## Stages (display variants)

`ServerSnapshot` is the canonical model of a connected server; there is deliberately **no intermediate "scene language"**. Every display variant is a *stage*: a component implementing the `StageProps` contract in `src/ui/stage.ts` (`snapshot`, `transportKind`, `selection`, `onSelect`). `App` owns connection, selection, and shared chrome (header, detail panel); stages are interchangeable. `FlowView` is the default stage; themed scenes (Dune today via its own overlay mechanism, wilder ideas later) become alternate stages behind the same contract (TODO-17). Shared derivation helpers (grouping, density) live beside the stage that spawned them and get extracted only when a third variant proves the abstraction (rule of three). The flow layout's input is shaped `sources[] → groups[] → items[]` so multi-server comparison (TODO-16) extends it without redesign.

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
    stage.ts               StageProps / EntitySelection — the display-variant contract
    flow/
      flowModel.ts         buildFlowModel — snapshot → groups/pills, adaptive density
      FlowView.tsx         Default stage: server node, clusters, pills, readout, filter, collapse
      TraceLayer.tsx       DOM-measured SVG traces (hairlines + heartbeat pulse)
    DetailPanel.tsx         Slide-in panel: schema table, resource contents, raw-JSON disclosure
    schema.ts               JSON Schema → argument table rows + friendlyType for DetailPanel
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
