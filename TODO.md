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

2026-08-30: **designed, costed and declined** — still open, but now with a measurement behind it. A Cloudflare Worker proxy was specified in `docs/external-sources/HANDOVER-mcp-explore-cors-proxy.md`; browser-shaped probes of its five candidate hosts found three (DeepWiki, Hugging Face, Microsoft Learn) already send full CORS headers and need nothing. Of the two that don't, Shopify storefronts require a shop domain the visitor must already know — a poor one-click demo — leaving **one** server, AWS Knowledge, as the whole yield, and Microsoft Learn substitutes for it directly. A hardcoded allowlist would also not serve the case this entry exists for (a visitor's *own* server, ISSUE-1): the fallback would fire and then 403. Making it general instead means running an open relay whose `Origin` check is one `curl -H` away from useless, sharing a 100k/day free cap with the demos it exists to serve. The effort went into the failure path instead — ISSUE-9 and `docs/specs/2026-08-30-connection-diagnostics.md`. Revisit if a real user's own server, not a demo, turns out to need it.

### TODO-8: Code-split the MCP SDK bundle

**Complexity**: S

`npm run build` warns the main chunk exceeds 500 kB because `@modelcontextprotocol/sdk` is bundled eagerly. Split it (dynamic import at the connect boundary or Vite `manualChunks`) when the real UI lands and load behaviour starts mattering. From final review of the 2026-08-24 scaffold branch.


### TODO-11: Playwright E2E tier (Tier 3)

**Complexity**: S

The initial design's testing intent names a Tier 3: Playwright smoke against the built-in demo server (no external network), run before deploys. Not yet set up — Tier 1/2 (Vitest + RTL against the real in-page demo server) carry coverage today. Wire Playwright + a CI step when UI churn settles.

### TODO-10: Choose a license

**Complexity**: S

Decision on 2026-08-24: repo went public with **no license** (source-visible, all rights reserved) to keep options open while TODO-4's paid-feature idea is unresolved. Revisit deliberately: MIT if we want reuse/contributions, AGPL if we want to deter closed-source hosted clones. Easy to add later; effectively impossible to retract.

### TODO-12: Graph & panel interaction hardening

**Complexity**: S

Deferred non-blocking items from the 2026-08-25 UI v1 final review: ~~cumulative (not per-step) drag threshold for pan-release deselect; pan factor accounting for letterboxing (use min of width/height ratios)~~ obsolete 2026-08-25 — the flow view has no pan/zoom; ~~dedupe/suffix duplicate tool/prompt names and resource URIs~~ done 2026-08-26 in `buildDeckModel` (exact duplicates dropped, first wins); ~~render non-string enum members via JSON.stringify and key chips by index~~ done 2026-08-30; ~~Escape closes the detail panel~~ done 2026-08-27 (Esc closes the console drawer, disarm takes precedence — spec `2026-08-27-console-drawer-dark-mode.md`); ~~focus moves into/restores from the drawer on open/close~~ resolved 2026-08-29 by deleting the drawer — the workspace is permanent, selection does not move focus, and the region announces its subject via `aria-live`; ~~disarm an armed tool button on focus leaving its card (blur)~~ obsolete 2026-08-29 — arming is gone; aria-live announcements (run states are `aria-live`/`role=alert` since 2026-08-26; selection announcements still open); ~~preserve remembered headers on `?server=` auto-connect and validate `headers`/`lastUsed` shapes in `loadRecents`~~ done 2026-08-30. **Only the selection aria-live announcement is left open.**

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

### TODO-31: Describe what runs where — and remove the one thing that made the description untrue

**Complexity**: S — **plan**: [`docs/plans/2026-08-30-what-runs-where.md`](docs/plans/2026-08-30-what-runs-where.md) — **Session A done 2026-08-30**

The app has an unusual architecture — zero backend, browser-direct, tokens never in URLs — and the landing page describes none of it, while asking visitors to paste an internal server address and often a bearer token beside it. Add a permanent block under the two doors: one descriptive line at rest, a **What runs where** disclosure holding an inventory grouped by question — where the code runs, what the page connects to, what is stored and where, and what the page does with what a server sends.

**It makes no safety claims, by instruction (2026-08-30), and §5.0 of the plan forbids them.** No "safe", "secure", "private", "protected"; no "we never", "enforced", "guaranteed". Every line is an observable fact about mechanism and the reader draws their own conclusion. That rule is what lets the awkward facts sit in the same plain voice as the rest — unencrypted local storage, GitHub Pages seeing the page request, the post-failure probe, the third-party example servers, and the `outputSchema` a server sends being compiled into a function. Under a claims framing each of those was an exception to manage; here each is just another line.

Verified 2026-08-30 before writing any of it, and the claim holds: no backend, the only `fetch(` in the codebase is `probe.ts`'s reachability probe against the visitor's own URL, no analytics or third-party scripts, fonts bundled rather than fetched, tokens confined to `localStorage` and the server they were saved against, results never persisted, and `script-src 'self'` enforcing it. The evidence table is §2 of the plan — it is the durable half, since the next dependency added is what would quietly falsify a line of the copy.

**One exception, which is why this is two sessions and not one.** Selection lives in the query string (TODO-25), so opening a shared link or reloading sends `?server=…` to GitHub Pages in the request for the document itself — the MCP server's address reaches GitHub's edge (never tokens, never arguments, never responses). Session A moves the canonical form to the **fragment** (`#server=…`), which is never transmitted, reading `?server=` forever for links already in the wild. It changes nothing on screen, is not blocked by the copy's design gate, and should ship first because it is what licenses the copy.

2026-08-30: **Session A shipped.** Selection now lives in `#server=…`, `?server=` is read forever for links already shared, and the address box, deep links, Back/Forward, folder-unfolding and the ISSUE-12 consent gate all behave as before. Verified in a real browser against the production build: the document request for a selected page carries **no query string and no trace of the server address**. Two things the plan had wrong turned up in the doing and are corrected in §4.1 — `URLSearchParams` strips a leading `?` but not a leading `#`, and "has a `server` key" is the wrong test for which half of the address bar wins, because a demo-server selection has no server in it at all.

Session B (the panel) is new furniture on the hero and therefore behind the CLAUDE.md visual-approval gate — **that gate holds even under an instruction to implement the whole plan**. 2026-08-30: **TODO-33 landed first, deliberately** — describing the system made it obvious that "a schema your server sends is compiled into a function in your browser" was a sentence better deleted from the world than written well. The panel now describes an interpreting validator under a plain `script-src 'self'`.


---

### TODO-32: A mobile layout for the workspace — L

The workspace has no mobile form. The browse column is a fixed 300px that never
yields, so on a 390px phone the workspace beside it is **90px**: a tool name
renders one character per line straight down the screen, the description clips
mid-word, and the argument form is off-screen entirely. Measured 2026-08-30 at
390 / 430 / 768 / 1024 — see ISSUE-17 for the numbers and the diagnosis.
Deferred by decision the same day, in favour of the desktop width work.

The landing page needs nothing: it already stacks and reflows well, with two
small nits worth folding in when this happens — the URL box is squeezed to about
24 characters by the Connect button beside it, and the longest example note
truncates ("search Microsoft and Azure d…").

The decision to make first is what the two columns become below roughly 900px:
stacking them into one scrolling page (simple, no new navigation ideas, but you
scroll past the whole list to reach every result), or list-then-panel with a way
back (much better to use, and the standard phone pattern, but it introduces a
navigation step the desktop layout does not have and would need its own spec).

## Completed

### TODO-33: Stop compiling untrusted schemas, and drop `'unsafe-eval'`

**Complexity**: S — **Completed 2026-08-30**

The CSP carried `'unsafe-eval'` under protest because the MCP SDK's default validator is AJV, which compiles each server-supplied `outputSchema` into a function with `new Function`. The weakened policy was the cheap half; the real one was that a JSON Schema from an untrusted server became executable code in the visitor's browser — the only place in this app where untrusted input reached a code generator (ISSUE-18).

`src/mcp/validator.ts` now passes the SDK `CfWorkerJsonSchemaValidator`, which interprets the schema instead of generating code, and both `new Client(…)` call sites take it through a shared `CLIENT_OPTIONS` so a third connect path cannot quietly be added without it. `script-src` is back to plain `'self'`.

**Dependency**: `@cfworker/json-schema` 4.1.1, the SDK's own optional peer — chosen over a hand-rolled validator because a validator is the wrong place to own a home-grown subset; its failure mode is silently accepting what it should reject. **Cost: bytes only, no paid resources.** +21.8 kB raw, **+5.8 kB gzipped** (790.9 → 812.7 kB). It is *added*, not substituted: AJV stays in the bundle because `client/index.js` imports it statically. It is never instantiated and never runs.

Two things worth keeping. First, the regression test is a real discriminator rather than a ritual — `validator.test.ts` runs a validation with the global `Function` binding replaced by a throwing proxy, and that was checked **both ways** before being relied on: AJV throws under the trap (printing the function it had built from the schema), the interpreting validator passes. Second, jsdom could never have caught the original bug and cannot confirm this fix; it was verified in a real browser against `https://mcp.deepwiki.com/mcp` under the tightened policy — connect, list and a real `read_wiki_structure` call, with zero CSP violations and zero page errors.


### TODO-9: Connection-layer hardening

**Complexity**: S — **Completed 2026-08-30**

Deferred Minors from the 2026-08-24 scaffold branch final review, held until their consumers appeared. The consumer turned out to be the connection-diagnostics work ([spec](docs/specs/2026-08-30-connection-diagnostics.md)), and all four landed with it:
- `listAll` is bounded by `MAX_PAGES` (100) **and** repeated-cursor detection — an untrusted server returning the same cursor forever, or a fresh one forever, no longer hangs the tab. Stopping early keeps the pages already fetched: a partial list beats an empty one.
- `ConnectFailure.attempts` carry `phase: "connect" | "snapshot"`, and the panel uses it: an attempt that reached the snapshot had already completed the handshake, so the transport *and* the browser's cross-origin checks are proven fine. That failure now reads "connected, then failed while listing what the server offers" and never triggers the CORS probe.
- ~~Allowlist `http:`/`https:` schemes in `connectUrl`~~ done 2026-08-25.
- `connectDemo`'s `close()` is `try`/`finally`, so a client-close failure can't leak the server side.
- The both-transports-fail test asserts `attempts[1].error` and both phases.

### TODO-30: Tool legibility — three zones in the workspace

**Complexity**: S — **Completed 2026-08-30**

The subject pane was one flat stack of seven elements at one rhythm, so nothing said which of them belonged together and the Run button sat at the bottom of a form four arguments tall. Now three zones — what it is, what it wants, what it gave back — with `ARGUMENTS` renamed **INPUT REQUIRED** (or **INPUT** when nothing is required, which is true of every demo tool), Run on the label's line, optional arguments folded behind a disclosure when something is required to fold beneath, the description clamped to three lines, and the result **contained** in a hairline region so the server's answer is visibly not part of the definition. The selected browse segment now takes its own kind's accent. Audited across tools, resources and prompts per CLAUDE.md; specced in [`docs/specs/2026-08-30-tool-legibility.md`](docs/specs/2026-08-30-tool-legibility.md).

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
