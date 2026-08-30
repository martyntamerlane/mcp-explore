# TODO — mcp-explore

Future enhancements and ideas. Complexity: S (small, <1 session), M (medium, 1–2 sessions), L (large, multiple sessions).

Each entry has a stable ID (`TODO-N`) that is never reused. Completed items move to the [Completed](#completed) section at the bottom, preserving their IDs so old links keep resolving.

---

## Deferred from initial design (2026-08-24)

### TODO-2: OAuth 2.1 authentication flow

**Complexity**: L

The MCP spec auth: protected-resource metadata discovery, dynamic client registration, PKCE, redirect handling, token refresh. Unlocks commercial remote servers (Linear, Sentry, etc.). v1 covers token-style auth via the custom-headers box only.

### TODO-3: stdio local bridge

**Complexity**: M

A small npx-distributed companion that exposes a local stdio MCP server over localhost HTTP (with CORS headers) so the hosted page can visualize it. Separate deliverable to build, version, and support.

### TODO-4: Semantic grouping in the graph — possible paid feature

**Complexity**: M

Group tools by shared prefix/namespace (`issues_create`, `issues_list` → `issues`) or by semantic similarity, adding a collapsible intermediate ring so 80-tool servers show ~8 tidy groups. v1 ships a flat ring (design spec decision #8). **Monetization note**: if this becomes a paid feature it needs an entitlement mechanism — a license-key check or a small auth'd API — which reopens the zero-backend decision; see design spec decision #9. Keep the layout code's grouping seam clean but build no entitlement machinery until this is a real goal.

2026-08-29: the grouping seam is now the browse column's tool list (`BrowseColumn`), not a graph ring — grouping would insert collapsible parents into that list. (A stray note about the light-first inversion sat here until 2026-08-29; it belongs to TODO-5, which carries it in Completed.)

### TODO-6: Docs-style list view as alternate to the graph

**Complexity**: M

A switchable master-detail (sidebar + detail pane) view over the same data, for users who want scanning/searching over spatial browsing. Only worth it if the graph alone proves insufficient.

2026-08-25: the flow view ([spec](docs/specs/2026-08-25-flow-view-design.md)) makes the diagram itself readable/scannable — likely obsoletes this. 2026-08-29: **effectively delivered** — the tool-first workspace *is* a master-detail list + detail pane (`docs/specs/2026-08-29-tool-first-workspace.md`). Keep the entry only as the record of that decision.

### TODO-7: Opt-in CORS proxy

**Complexity**: M

For servers that don't send CORS headers. Requires serious SSRF hardening (private-IP blocking, DNS-rebinding defense), infrastructure, cost exposure, and a token-custody trust story — which is why v1 is browser-direct only with a CORS diagnostic panel instead. Revisit only if CORS-blocked servers turn out to be a major share of real usage.

### TODO-8: Code-split the MCP SDK bundle

**Complexity**: S

`npm run build` warns the main chunk exceeds 500 kB because `@modelcontextprotocol/sdk` is bundled eagerly. Split it (dynamic import at the connect boundary or Vite `manualChunks`) when the real UI lands and load behaviour starts mattering. From final review of the 2026-08-24 scaffold branch.

### TODO-9: Connection-layer hardening

**Complexity**: S

Deferred Minors from the 2026-08-24 scaffold branch final review, best done when their consumers appear (graph UI / CORS diagnostics plan):
- Cap `listAll` pagination (`MAX_PAGES` + repeated-cursor detection) — a malicious server returning the same cursor forever hangs the tab (`src/mcp/connect.ts` cursor loop).
- Tag `ConnectFailure.attempts` with a `phase: "connect" | "snapshot"` field so the diagnostics panel can distinguish transport failures from mid-listing application errors.
- ~~Allowlist `http:`/`https:` schemes in `connectUrl` before shareable `?server=` URLs and clickable recent-servers exist.~~ done 2026-08-25
- Wrap `connectDemo`'s `close()` in try/finally so a client-close failure can't leak the server side.
- Assert `attempts[1].error` text in the both-transports-fail test.

### TODO-11: Playwright E2E tier (Tier 3)

**Complexity**: S

The initial design's testing intent names a Tier 3: Playwright smoke against the built-in demo server (no external network), run before deploys. Not yet set up — Tier 1/2 (Vitest + RTL against the real in-page demo server) carry coverage today. Wire Playwright + a CI step when UI churn settles.

### TODO-10: Choose a license

**Complexity**: S

Decision on 2026-08-24: repo went public with **no license** (source-visible, all rights reserved) to keep options open while TODO-4's paid-feature idea is unresolved. Revisit deliberately: MIT if we want reuse/contributions, AGPL if we want to deter closed-source hosted clones. Easy to add later; effectively impossible to retract.

### TODO-12: Graph & panel interaction hardening

**Complexity**: S

Deferred non-blocking items from the 2026-08-25 UI v1 final review: ~~cumulative (not per-step) drag threshold for pan-release deselect; pan factor accounting for letterboxing (use min of width/height ratios)~~ obsolete 2026-08-25 — the flow view has no pan/zoom; ~~dedupe/suffix duplicate tool/prompt names and resource URIs~~ done 2026-08-26 in `buildDeckModel` (exact duplicates dropped, first wins); render non-string enum members via JSON.stringify and key chips by index; ~~Escape closes the detail panel~~ done 2026-08-27 (Esc closes the console drawer, disarm takes precedence — spec `2026-08-27-console-drawer-dark-mode.md`); ~~focus moves into/restores from the drawer on open/close~~ resolved 2026-08-29 by deleting the drawer — the workspace is permanent, selection does not move focus, and the region announces its subject via `aria-live`; ~~disarm an armed tool button on focus leaving its card (blur)~~ obsolete 2026-08-29 — arming is gone; aria-live announcements (run states are `aria-live`/`role=alert` since 2026-08-26; selection announcements still open); preserve remembered headers on `?server=` auto-connect and validate `headers`/`lastUsed` shapes in `loadRecents`.

### TODO-21: Structured editing for nested schema shapes

**Complexity**: M

The input forms (TODO-1) render nested objects, arrays of objects and mixed `anyOf`/`oneOf` unions as a raw JSON textarea labelled with the type — honest, but it asks the user to hand-write JSON. Simple unions already resolve to real controls (2026-08-29). Worth doing when a real server's important tool proves painful: object fields as nested field groups, arrays of objects as repeatable rows, and a variant picker for unions. `src/ui/form/argValues.ts` (`fieldSpecs`/`assembleArgs`) is the seam — it maps schema to `FieldSpec[]` and back to arguments, so richer kinds slot in without touching the views.

### TODO-13: Force separate Vite chunks for dune mode's entry

**Complexity**: S

Production builds currently merge `src/main.tsx` and `src/dune/main.tsx` into one flat module-evaluation scope rather than two physically separate script chunks (a Vite/Rolldown default; the dune-mode plan's own constraints forbade a `vite.config.ts` change). Practical effect: a synchronous top-level exception in the main app's entry could in principle also abort dune's mount statement, which wouldn't happen with two genuinely separate `<script type="module">` graphs. Parked as negligible risk during the 2026-08-24 dune-mode final review (if the main app's top-level module evaluation throws, the user already has a broken page regardless of dune mode). Revisit via `manualChunks`/`rolldownOptions.output.codeSplitting` only if this ever proves to matter in practice.

### TODO-14: Dune mode's post-connect polish

**Complexity**: S

From the 2026-08-24 dune-mode final review: the departure-transition auto-hide is a fixed timer (not synced to the real connect outcome, by design — see the spec), and a manual browser smoke check (Konami sequence, transition, `localStorage` persistence across reload, toggle-off) was never performed since no browser was available during implementation. Do this smoke check before considering dune mode fully verified.

### TODO-16: Multi-server connect + semantic tool comparison

**Complexity**: L

The differentiating idea (2026-08-25 flow-view grill session): connect to several MCP servers at once and semantically compare their tools. ~~The flow view's geometry already accommodates it — N source nodes on the left edge, a shared capability field on the right, semantic clusters receiving provenance-marked traces, so overlap/gaps/unique capabilities become visible as convergence/absence/single-source clusters.~~ 2026-08-26: the luminous-deck redesign replaces that geometry — the multi-server seam is now **tiled server boundaries** (one named deck per server; see `docs/specs/2026-08-26-luminous-deck-redesign.md` §3); the semantic-comparison presentation will need its own design when this is picked up. `buildFlowModel`'s grouping seam (kind-grouping today, grouping-as-a-function by design) is the extension point; see also TODO-4's single-server semantic grouping. **Monetization note**: like TODO-4, if this becomes a paid feature it needs an entitlement mechanism, which reopens the zero-backend decision (initial design decision #9) — no entitlement machinery until that's a real goal.

### TODO-18: WebGL/shader server core (volumetric gate)

**Complexity**: M

2026-08-26 (later): likely **moot** — the luminous-deck redesign (`docs/specs/2026-08-26-luminous-deck-redesign.md`) retires the gate-ring core along with the flow view. Keep only if a future stage wants a WebGL centrepiece. Original text: offered during the 2026-08-26 visual passes and not yet approved: replace the CSS gate ring with a WebGL/GLSL rendering — volumetric light scattering, refraction, a particle field around the core. Requires a real dependency decision (three.js ~150 kB, or hand-rolled GLSL with more code), GPU cost, and `prefers-reduced-motion`/fallback handling; the CSS ring stays the fallback either way. Only pick this up with explicit user approval of the dependency (CLAUDE.md dependency rule).

### TODO-17: Adapt the Dune scene to the stage contract

**Complexity**: S

The flow view introduced `StageProps` (`src/ui/stage.ts`) as the display-variant contract; the Dune scene predates it and runs via its own overlay/entry mechanism. Rendering it as a stage would unify variant switching. Coordinate with (or leave to) the session that owns `src/dune/` — see the isolation rationale in `docs/architecture-overview.md`.

### TODO-24: Markdown subset gaps

**Complexity**: S

`src/ui/markdown/parse.ts` implements a subset, not CommonMark (rationale and the full list in `docs/specs/2026-08-29-markdown-rendering.md` §2.1). 2026-08-29: **HTML blocks are done** — the reading pass (`docs/specs/2026-08-29-reading-pass.md` §3.4) drops a line that is nothing but a known tag and keeps the text a tag pair wrapped, because deepwiki opens every result with `<details>`/`<summary>`. The rest of the list stands.

Not implemented, and degrading to plain text today: reference links (`[a][b]` with a definition block), setext headings (`===`/`---` underlines), footnotes, task-list checkboxes, and loose-vs-tight list spacing. Nested blockquotes and lists work but only to depth 6. Pick this up if a real server's output actually looks wrong — or, if the list grows, take it as the signal to swap in `react-markdown` after all; `parse.ts` and `Markdown.tsx` are the only two files that would change.


---

## Completed

### TODO-26: Keyboard navigation and command mode

**Complexity**: M — **Completed 2026-08-30**

The app has exactly one key binding (Esc → home). Make the **existing** filter input in the chrome band the keyboard surface: `/` focuses it, ↑↓ walk the filtered list, ⏎ selects, `>` switches it to command mode. Deliberately **not** a ⌘K overlay — every source points at one, and it is the archetypal arriving surface this project has twice rejected; the permanent filter box gets a second job instead. Includes shortcut legibility (keycap glyphs are a new visual pattern needing approval). Sessions **S1** (navigation) and **S2** (command mode) of the interaction roadmap.

2026-08-29: **S1 shipped** — `/`, ↑↓ (a highlight, not a per-keystroke selection), ⏎, →←, and Escape's two-stage unwind, with the key model pure in `src/ui/deck/keynav.ts` (`docs/specs/2026-08-29-addressable-selection.md`).

2026-08-30: **S2 shipped — this TODO is done.** `>` in the filter turns the browse column into the command list (six commands, all second routes to existing buttons), matching and dispatch pure in `src/ui/deck/commands.ts`, and shortcut legibility carried by an approved flat keycap — inside the filter (`/` at rest, `>` when focused) and as a legend under the command list. `--radius-xs` added for it. `docs/specs/2026-08-29-command-mode.md`.

### TODO-29: Result outline in the right margin

**Complexity**: S — **Completed 2026-08-29**

A sticky **ON THIS PAGE** list built from the heading levels the parser already emits, making deepwiki's 76-heading `read_wiki_contents` navigable. It fills the margin the reading pass created — 780 content + 32 + 200 outline fits inside the existing 1080 subject cap — so it costs the reading measure nothing. Session **S4** of [`docs/plans/2026-08-29-interaction-roadmap.md`](docs/plans/2026-08-29-interaction-roadmap.md), specced in [`docs/specs/2026-08-29-result-outline.md`](docs/specs/2026-08-29-result-outline.md).

Resolved in-session: **three headings** is the threshold (checked against a short `ask_question` answer, `read_wiki_contents` and a Hugging Face `SKILL.md`); **1380px** is the width below which it simply is not there, with no mobile substitute; the home view's `instructions` are not outlined. Anchors and entries come from one function (`parseDocument`) so they cannot drift, and ids carry a per-block prefix so two blocks opening with the same heading do not collide.

Recorded for the next component that measures the DOM: the first version returned `null` until it had measured, so it never had a node to measure from and never appeared — silently, on the live site only, with every unit test passing. It now stays mounted and marks itself `data-empty`.

### TODO-27: Run history per tool

**Complexity**: M — **Completed 2026-08-29**

`RunContext` kept exactly one result per tool name, so running a tool again with different arguments discarded the previous answer — request history being the one feature every API client treats as core. A tool now keeps its last **ten** runs, newest first, each labelled by its arguments and restorable into the form so "edit and re-run" is one click. Failed runs join the list beside the successes. In memory only: persisting server responses has a token/PII surface that needs its own decision, and a single deepwiki result is ~1 MB. Session **S3** of [`docs/plans/2026-08-29-interaction-roadmap.md`](docs/plans/2026-08-29-interaction-roadmap.md), specced in [`docs/specs/2026-08-29-run-record.md`](docs/specs/2026-08-29-run-record.md). The state shape is pure in `src/ui/run/runHistory.ts`; `valuesFromArgs` in `argValues.ts` is the restore path and round-trips against `assembleArgs`.

Label budget resolved live: each argument value gets an **equal share**, not first-come truncation — deepwiki's long `repoName` otherwise ate the whole budget and left every run labelled `question: How does…`.

### TODO-28: Honest progress during a run

**Complexity**: S — **Completed 2026-08-29**

A call in flight now shows a ticking elapsed time (`Running… 4.2s`) instead of a static word, for tool runs and for slow resource/prompt reads alike.

The spike the plan required, answered 2026-08-29: the installed SDK **does** surface `notifications/progress` to a browser client (`callTool(..., { onprogress, resetTimeoutOnProgress })`), and **no real server sends any** — measured zero notifications from deepwiki `read_wiki_contents` (0.8 s), deepwiki `ask_question` (12.2 s) and Hugging Face `hub_repo_search`. `onprogress` is wired regardless and its report renders beside the counter, but elapsed time is what carries the common case. The plan's other fallback — a live character count as text arrives — is **not possible**: `tools/call` returns one JSON-RPC result, not a stream, so nothing arrives until everything does; claiming a count would have been the dishonest option.

### TODO-25: Selection in the URL

**Complexity**: S — **Completed 2026-08-29**

`?server=…&tool=NAME` (and `&resource=`/`&prompt=`) so a link can address a specific subject, Back/Forward walk selection history, and reload holds your place. Before this, `App.tsx` put only the server in the URL and used `replaceState` for everything, so every share and every reload landed on Home — a hole in the app's core promise, since the whole pitch is "paste a URL and see inside a server". Session **S1** of [`docs/plans/2026-08-29-interaction-roadmap.md`](docs/plans/2026-08-29-interaction-roadmap.md), specced in [`docs/specs/2026-08-29-addressable-selection.md`](docs/specs/2026-08-29-addressable-selection.md).

Decisions worth keeping: a user-made selection pushes, everything the app decides replaces, and `popstate` reads the URL without writing back. A subject the server does not expose — or an empty parameter, or two kinds at once — reads as home and is cleaned out of the URL rather than shown as an error. A selection applies only to the server its link named. **A deep link opens a zero-argument tool but does not run it**, unlike a click. Resource URIs stay URIs rather than becoming indices: measured against Hugging Face, a link to a resource three folders deep is 143 characters, and an index would break the moment the server reorders its list.

### TODO-20: Resolve the three visual picks

**Complexity**: S — **Completed 2026-08-29**

Open since the 2026-08-26 visual-iteration checkpoint and resolved in the reading pass (`docs/specs/2026-08-29-reading-pass.md` §3.6). (1) **UI face**: **Inter** — every measurement and spacing call in the tightening spec was made against it, and Geist's differences at 13–15px are not worth re-tuning a just-tuned scale; `@fontsource-variable/geist` uninstalled. (2) **Prism variant**: **"b"**, the closed triangle, now the default in `Prism.tsx` and the app's first favicon (inline data URI in `index.html`, with a `prefers-color-scheme` stroke swap) — at 16px "a" and "c" both collapse into indistinct scratches. (3) **Grain on light**: stays dropped; the luminous canvas gets its life from the gradient, and texture works against a page that just became denser. See also TODO-22, decided in the same sitting as intended.

### TODO-22: Pin the mono face

**Complexity**: S — **Completed 2026-08-29**

`--mono` was the app's only unpinned family while carrying every tool, resource, prompt and folder name, every input, every code block and the server's name in the chrome band — so the app's dominant texture was a different typeface on every OS. Pinned to **JetBrains Mono Variable** via Fontsource (~40 kB latin subset, ~10 kB over the estimate flagged at approval), chosen over IBM Plex Mono for its taller lowercase, which is what keeps 12px inline code legible beside 15px Inter. `docs/specs/2026-08-29-reading-pass.md` §3.3.

### TODO-23: Clamp long server `instructions`

**Complexity**: S — **Completed 2026-08-29**

Hugging Face's 1,555-character `instructions` string rendered as a ~20-line wall on the home view that buried the counts above it. Clamped to six lines with a **Show more** control (`HomeView.tsx` / `Workspace.module.css .clamped`); overflow is measured from `scrollHeight` rather than guessed from a character count, since the clamp is a line count and lines depend on the measure, the face and the viewport. Nothing is discarded. The progressive-disclosure control was confirmed with the user before building, per CLAUDE.md. `docs/specs/2026-08-29-reading-pass.md` §3.5.

### TODO-19: Landing-page priority pass

**Complexity**: S — **Completed 2026-08-29**

The landing inverted its own priority: "Explore a live demo" carried the tinted wash, the lit hairline and the prism, while "Connect your server" — the app's actual purpose — was a plain box with a greyed-out Connect button. Diagnosed during the 2026-08-29 UX cohesion pass and left out of that work's scope (`docs/specs/2026-08-29-tool-first-workspace.md` §12); executed in the visual-system tightening the same day (`docs/specs/2026-08-29-visual-system-tightening.md` §6). The CTA treatment and the prism moved to the Connect door, which gained a one-line sub naming the actual differentiator; the demo door became a calm secondary with a neutral button. Both doors now share one structure and centre their contents, and the hero is centred in the viewport rather than finishing 40% up the page.

### TODO-1: Tool calling with schema-driven forms

**Complexity**: L — **Completed 2026-08-29**

The v1 flagship, deferred from the initial design (decision #5) and shipped by the tool-first workspace redesign (`docs/specs/2026-08-29-tool-first-workspace.md` §5). Fields are generated from each tool's `inputSchema` — text, number, true/false, one-of, comma-separated list of text — with a JSON textarea fallback for nested objects, arrays of objects and `oneOf`/`anyOf` so nothing is silently hidden. Schema defaults prefill, required fields gate Run with the reason in plain text, empty optionals are omitted rather than sent as `""`, and unparseable numbers/JSON block the run with an inline message. Prompt arguments reuse the same form. Pure logic and its tests live in `src/ui/form/argValues.ts`.

**Not covered, if it ever matters**: structured editing *inside* nested objects and arrays of objects (they get the raw JSON field), and `oneOf`/`anyOf` variant pickers.


### TODO-5: Light theme (inverted: dark theme)

**Complexity**: S — **Completed 2026-08-27**

Originally "v1 is dark-first, add a light theme + `prefers-color-scheme` toggle." The 2026-08-26 luminous-deck redesign inverted the premise (light became the default identity), so this became "add dark mode" — executed 2026-08-27 per `docs/specs/2026-08-27-console-drawer-dark-mode.md`: validated luminous-dark token block under `data-mode="dark"` (Dune wins via `:not()` guard), system-follow with a persistent sun/moon toggle.

### TODO-15: Baseline (non-dune) landing-page redesign

**Complexity**: M — **Completed 2026-08-26**

A general visual/UX redesign of the landing screen for usefulness and "stickiness," aiming for a more futuristic/minimalist/artistic feel — the piece of the 2026-08-24 dune-mode brainstorming session that was deliberately decomposed out as a separate, not-yet-brainstormed sub-project (dune mode itself is a skin/extension of this baseline, not a replacement for it).

2026-08-26: brainstormed (grill session), specced as part of the whole-journey **luminous-deck redesign** (`docs/specs/2026-08-26-luminous-deck-redesign.md` — light identity, control-deck IA, run verb, two-door landing) and executed on `feat/luminous-deck` per `docs/plans/2026-08-26-luminous-deck-implementation.md`.
