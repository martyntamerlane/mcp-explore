# Architecture Overview — mcp-explore

> **Status**: Built (tool-first workspace 2026-08-29, see [`docs/specs/2026-08-29-tool-first-workspace.md`](specs/2026-08-29-tool-first-workspace.md) — replaced the deck grid + rail + console drawer of the 2026-08-26/27 specs, which carry banners saying what still stands). This file documents reality — project structure, module map, state shape — updated in the same change as the code.

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

React 19 + Vite + TypeScript, CSS Modules, `@modelcontextprotocol/sdk` (browser client), `motion` (choreography: the column's power-on cascade and the workspace's subject cross-fade — CSS handles all static-state transitions), self-hosted fonts via Fontsource (Space Grotesk display + Inter UI + JetBrains Mono identifiers — all three pinned 2026-08-29; ~40 kB latin subset for the mono), hand-rolled deterministic layout (no graph/physics libraries), Vitest + RTL (Playwright tier still TODO-11).

## Stages (display variants)

`ServerSnapshot` is the canonical model of a connected server; there is deliberately **no intermediate "scene language"**. Every display variant is a *stage*: a component implementing the `StageProps` contract in `src/ui/stage.ts` (`snapshot`, `transportKind`, `selection`, `onSelect`, `query`, `onQuery`, `onFocusFilter` — the last two so a stage can clear and focus the band's filter from its own key model). `App` owns connection, selection, the filter query, run state (via `RunProvider`), read state (via `ReadProvider`), and the chrome band; stages are interchangeable. `DeckView` is the default stage — a browse column plus a workspace, nothing else; themed scenes (Dune today via its own overlay mechanism) become alternate stages behind the same contract (TODO-17).

**Selection is the whole navigation model**: `EntitySelection | null`, where `null` means home — and since 2026-08-29 it is also **addressable**, living in the query string as one of `tool`/`resource`/`prompt` beside `server` (spec [`2026-08-29-addressable-selection.md`](specs/2026-08-29-addressable-selection.md)). `App` owns every History call: `pushState` for a user-initiated selection, `replaceState` for anything the app decided, plus a `popstate` listener that reads the URL back without writing to it, so the two can never chase each other. `src/ui/selectionUrl.ts` is the pure counterpart — what the strings mean, and whether a snapshot still contains them. All three kinds select; the workspace renders whichever is selected. Selecting a zero-argument tool is also its run — that rule lives in `DeckView.select`, the one place the click contract is expressed. Run and read state deliberately live in Contexts *beside* the stage rather than in `StageProps`, so the contract stays display-only. Run state is a **capped per-tool history** rather than one result (`src/ui/run/runHistory.ts`, spec [`2026-08-29-run-record.md`](specs/2026-08-29-run-record.md)); it is session-only and never persisted, for the same reason form values are not. Form values live in `DeckView`, keyed by subject, so a part-filled form survives switching subject; they are session-only and never persisted, because arguments can carry anything the user typed.

The app has **no overlay surfaces and no tooltips** in the connected view. Light/dark mode is a root `data-mode` attribute re-valuing tokens (`src/ui/mode.ts`); Dune wins via a `:not()` guard, untouched. The chrome band is the multi-server seam (TODO-16): a second connection renders a second band plus column/workspace pair tiled alongside.

## State & storage

- App state: React Context + hooks. No external state libraries.
- Run history: in memory only, ten runs per tool, cleared on disconnect/reload — never localStorage (results can be megabytes and carry whatever the server chose to return).
- localStorage: recent servers; optionally their headers (user can decline storing tokens).
- URL query string: `?server=…` plus at most one of `&tool=`/`&resource=`/`&prompt=` — never headers/tokens.

## Project structure

```
index.html            Vite entry
src/
  main.tsx            React bootstrap (fonts, MotionConfig reduced-motion floor)
  App.tsx             Top-level composition: idle/connected phases, server + selection URL sync
                      (push/replace/popstate), filter query and focus, Run/Read providers
  App.module.css      CSS module for App component
  App.test.tsx        Tests for App component
  global.css          Light-first CSS custom properties (validated luminous palette; first :root
                      block is the dune token-parity contract — see src/dune/theme.test.ts) plus
                      the validated luminous-dark re-values under [data-mode="dark"], then a
                      SECOND :root block holding the structural scale — type (--fs-*), spacing
                      (--sp-*), tracking (--track-*), measures (--measure-*) and the font stacks.
                      New non-colour tokens go in that second block: the parity test scans only
                      the first and would demand a dune equivalent. See
                      docs/specs/2026-08-29-visual-system-tightening.md
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
    stage.ts               StageProps / EntitySelection — the display-variant contract (null selection = home)
    selectionUrl.ts        Pure: query string <-> EntitySelection, resolve against a snapshot, compare
    ChromeBar.tsx          The single chrome band: brand, server identity, filter, mode toggle, disconnect
    deck/
      deckModel.ts         buildDeckModel — snapshot → tools (readOnly/zeroArg) + browse groups (mime, prompt args), dedupe
      browseTree.ts        buildBrowseTree — resource URIs → thresholded folder tree (chain-collapse, scheme handling)
      DeckView.tsx         Default stage: browse column + workspace; owns the click contract and per-subject form values
      BrowseColumn.tsx     Left index: home, segmented Tools/Resources/Prompts, folder tree, power-on
                           cascade; owns the app's key model (highlight, /, arrows, Enter, Escape)
      keynav.ts            Pure: flatten the visible rows, move the highlight, map a keystroke to an
                           action, name the folders above a leaf
      Workspace.tsx        Permanent work surface; routes the selected subject to one of the four views
      HomeView.tsx         Server identity, counts and the server's own `instructions`
      ToolView.tsx         Description, args form, Run, result, raw-JSON disclosure
      ResourceView.tsx     Metadata + contents, loaded on selection
      PromptView.tsx       Description, args form, Get prompt, returned messages
      blocks.tsx           Shared render for sanitized read/run block lists
      Glyph.tsx            Entity shape coding (circle/square/diamond), colourless — the row decides
      Prism.tsx            The brand mark (hairline prism, 3 variants)
    form/
      argValues.ts         Pure: inputSchema → FieldSpec[]; form strings → tools/call arguments; validation
      ArgsForm.tsx         The generated fields (text/number/boolean/enum/list, JSON fallback)
    run/
      runResult.ts         formatCallResult/formatRunError — untrusted result → sanitized RunDisplay, size cap
      readResult.ts        formatResourceContents/formatPromptMessages — untrusted reads → sanitized ReadDisplay
      runHistory.ts        Pure: the per-tool run history state shape (start/progress/settle/view,
                           the ten-run cap) plus run labels and elapsed/progress formatting
      RunContext.tsx       RunProvider/useRuns — per-tool run history over client.callTool, with
                           onprogress wired for servers that report
      ReadContext.tsx      ReadProvider/useReads — cached reads over readResource/getPrompt(name, args)
    markdown/
      detect.ts             looksLikeMarkdown — declared mime first, then a deliberately
                            conservative heuristic; JSON is never markdown
      parse.ts              Markdown subset → Block/Inline data. The output type contains no
                            HTML, so no downstream layer can inject any. safeHref allowlists
                            http/https/mailto and refuses relative and protocol-relative URLs
      Markdown.tsx          Block/Inline → React elements. No dangerouslySetInnerHTML, ever;
                            images render as links rather than firing a remote request
    schema.ts               JSON Schema → schemaRows + friendlyType, under argValues and the views
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
