# Architecture Overview — mcp-explore

> **Status**: Built (luminous-deck redesign 2026-08-26, see [`docs/specs/2026-08-26-luminous-deck-redesign.md`](specs/2026-08-26-luminous-deck-redesign.md) — replaced the 2026-08-25 flow view). This file documents reality — project structure, module map, state shape — updated in the same change as the code.

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

React 19 + Vite + TypeScript, CSS Modules, `@modelcontextprotocol/sdk` (browser client), `motion` (choreography: power-on cascade, drawer/unfold folds, AnimatePresence — CSS handles all static-state transitions), self-hosted fonts via Fontsource (Space Grotesk display + Inter UI), hand-rolled deterministic deck layout (no graph/physics libraries), Vitest + RTL (Playwright tier still TODO-11).

## Stages (display variants)

`ServerSnapshot` is the canonical model of a connected server; there is deliberately **no intermediate "scene language"**. Every display variant is a *stage*: a component implementing the `StageProps` contract in `src/ui/stage.ts` (`snapshot`, `transportKind`, `selection`, `onSelect`). `App` owns connection, selection, run state (via `RunProvider`), rail-load state (via `ReadProvider`), and shared chrome (brand header with mode toggle); stages are interchangeable. `DeckView` is the default stage; themed scenes (Dune today via its own overlay mechanism) become alternate stages behind the same contract (TODO-17). Run and read state deliberately live in Contexts *beside* the stage rather than in `StageProps`, so the contract stays display-only and the drawer sees the same per-tool state. Selection is tools-only since the rail-browser redesign (rail rows unfold in place and never call `onSelect`); it drives the console drawer, which `DeckView` renders inside the server boundary — the app has no overlay surfaces. Light/dark mode is a root `data-mode` attribute re-valuing tokens (`src/ui/mode.ts`); Dune wins via a `:not()` guard, untouched. The deck's server boundary is the multi-server seam (TODO-16): a second connection renders a second boundary tiled alongside.

## State & storage

- App state: React Context + hooks. No external state libraries.
- localStorage: recent servers; optionally their headers (user can decline storing tokens).
- URL query string: `?server=…` only — never headers/tokens.

## Project structure

```
index.html            Vite entry
src/
  main.tsx            React bootstrap (fonts, MotionConfig reduced-motion floor)
  App.tsx             Top-level composition: idle/connected phases, ?server= URL sync, RunProvider
  App.module.css      CSS module for App component
  App.test.tsx        Tests for App component
  global.css          Light-first CSS custom properties (validated luminous palette; first :root
                      block is the dune token-parity contract — see src/dune/theme.test.ts) plus
                      the validated luminous-dark re-values under [data-mode="dark"]
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
    ConnectScreen.tsx      Two-door landing: connect door (URL/headers/recents), demo door
    ConnectError.tsx       Connect-failure diagnostics (CORS hints, per-transport detail)
    recents.ts             localStorage recent-servers list (opt-in header persistence)
    stage.ts               StageProps / EntitySelection — the display-variant contract
    deck/
      deckModel.ts         buildDeckModel — snapshot → tools (run-classed) + rail groups (with mime/prompt args), dedupe, emphasis
      railTree.ts          buildRailTree — resource URIs → thresholded folder tree (chain-collapse, scheme handling)
      armState.ts          pressTool — pure arm-then-fire transition; ARM_TIMEOUT_MS
      DeckView.tsx         Default stage: server boundary, tool grid + rail (right), console drawer, filter, power-on choreography
      ToolButton.tsx       One tool: face + info sibling + anchored tooltip; armed/running/needs-input states
      ToolDrawer.tsx       Console drawer docked in the boundary's bottom edge: identity | args table | RUN
      Rail.tsx             Right-flank browser: folder tree, in-place accordion unfold, auto-load via useReads
      Glyph.tsx            Entity shape coding (circle/square/diamond)
      Prism.tsx            The brand mark (hairline prism, 3 variants)
    run/
      runResult.ts         formatCallResult/formatRunError — untrusted result → sanitized RunDisplay, size cap
      readResult.ts        formatResourceContents/formatPromptMessages — untrusted reads → sanitized ReadDisplay
      RunContext.tsx       RunProvider/useRuns — per-tool run state over client.callTool
      ReadContext.tsx      ReadProvider/useReads — cached rail loads over readResource/getPrompt
    schema.ts               JSON Schema → argument table rows + friendlyType for ToolDrawer
    mode.ts                 Light/dark resolution: stored choice > system; data-mode stamping; live follow
    ModeToggle.tsx          Sun/moon toggle (header + landing) persisting explicit choices
    *.module.css            CSS modules for each ui/ component
    *.test.ts[x]            Colocated tests for each ui/ module
  dune/
    main.tsx               Independent bootstrap: mounts DuneOverlay into its own React root
    DuneOverlay.tsx         Konami trigger, localStorage persistence, theme-attribute sync
    konami.ts               Deterministic rolling-buffer Konami-sequence detector
    CinematicScene.tsx      Full-bleed animated backdrop: hero image, parallax layers, starfield, sun, haze, grain
    assets/hero.webp        The AI-generated hero image (source PNG in docs/external-sources/)
    theme.css               :root[data-theme="dune"] token overrides (see spec, 2026-08-26-dune-cinematic-redesign.md)
    *.module.css, *.test.ts[x]   CSS modules and colocated tests
```

**Dune mode's isolation** (see [`docs/specs/2026-08-24-dune-mode-design.md`](specs/2026-08-24-dune-mode-design.md), scene redesigned per [`docs/specs/2026-08-26-dune-cinematic-redesign.md`](specs/2026-08-26-dune-cinematic-redesign.md)): `src/dune/` shares no files, imports, or component coupling with the rest of `src/`. It is loaded via a second, independent `<script type="module" src="/src/dune/main.tsx">` entry in `index.html` — the only file outside `src/dune/` the feature touches, by exactly one added line. It reaches the rest of the page only through generic `document`-level DOM observation (`keydown` for the trigger; pointer position is read passively for parallax), never `preventDefault`/`stopPropagation`, and reskins the whole app purely via a second CSS token block cascading over the same `var(--…)` custom properties every component already uses. This was a deliberate choice to allow it to be built concurrently with other work touching `App.tsx`/`global.css`/`ConnectScreen.tsx`/`Graph.tsx` without merge risk.

Tests are colocated (`*.test.ts[x]`), run by Vitest (jsdom, globals).

## Deployment

GitHub Pages via a GitHub Actions workflow: build Vite on push to main, publish. Pushing to main is therefore a deploy (see CLAUDE.md). Releases are logged in `DEPLOYMENTS.md`.
