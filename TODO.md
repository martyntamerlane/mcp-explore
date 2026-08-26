# TODO — mcp-explore

Future enhancements and ideas. Complexity: S (small, <1 session), M (medium, 1–2 sessions), L (large, multiple sessions).

Each entry has a stable ID (`TODO-N`) that is never reused. Completed items move to the [Completed](#completed) section at the bottom, preserving their IDs so old links keep resolving.

---

## Deferred from initial design (2026-08-24)

### TODO-1: Tool calling with schema-driven forms

**Complexity**: L

The v2 flagship. Generate argument forms from each tool's JSON Schema, invoke the tool, render results inline in the detail panel. Deliberately excluded from v1 (design spec decision #5) because form generation from arbitrary JSON Schema is the single biggest feature in the app.

### TODO-2: OAuth 2.1 authentication flow

**Complexity**: L

The MCP spec auth: protected-resource metadata discovery, dynamic client registration, PKCE, redirect handling, token refresh. Unlocks commercial remote servers (Linear, Sentry, etc.). v1 covers token-style auth via the custom-headers box only.

### TODO-3: stdio local bridge

**Complexity**: M

A small npx-distributed companion that exposes a local stdio MCP server over localhost HTTP (with CORS headers) so the hosted page can visualize it. Separate deliverable to build, version, and support.

### TODO-4: Semantic grouping in the graph — possible paid feature

**Complexity**: M

Group tools by shared prefix/namespace (`issues_create`, `issues_list` → `issues`) or by semantic similarity, adding a collapsible intermediate ring so 80-tool servers show ~8 tidy groups. v1 ships a flat ring (design spec decision #8). **Monetization note**: if this becomes a paid feature it needs an entitlement mechanism — a license-key check or a small auth'd API — which reopens the zero-backend decision; see design spec decision #9. Keep the layout code's grouping seam clean but build no entitlement machinery until this is a real goal.

### TODO-5: Light theme

**Complexity**: S

v1 is dark-first. All colours are already CSS custom properties, so this is a variable set + toggle honouring `prefers-color-scheme`, plus visual QA.

### TODO-6: Docs-style list view as alternate to the graph

**Complexity**: M

A switchable master-detail (sidebar + detail pane) view over the same data, for users who want scanning/searching over spatial browsing. Only worth it if the graph alone proves insufficient.

2026-08-25: the flow view ([spec](docs/specs/2026-08-25-flow-view-design.md)) makes the diagram itself readable/scannable (always-visible labels, adaptive density, vertical scroll) — likely obsoletes this; revisit only if real usage still shows scanning pain.

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

Deferred non-blocking items from the 2026-08-25 UI v1 final review: ~~cumulative (not per-step) drag threshold for pan-release deselect; pan factor accounting for letterboxing (use min of width/height ratios)~~ obsolete 2026-08-25 — the flow view has no pan/zoom; dedupe/suffix duplicate tool/prompt names and resource URIs in ~~`computeLayout`~~ `buildFlowModel` (duplicate React keys otherwise); render non-string enum members via JSON.stringify and key chips by index; Escape closes the detail panel + focus moves into/restores from it; aria-live announcements (the flow view's readout strip is `aria-live`; selection announcements still open); preserve remembered headers on `?server=` auto-connect and validate `headers`/`lastUsed` shapes in `loadRecents`.

### TODO-13: Force separate Vite chunks for dune mode's entry

**Complexity**: S

Production builds currently merge `src/main.tsx` and `src/dune/main.tsx` into one flat module-evaluation scope rather than two physically separate script chunks (a Vite/Rolldown default; the dune-mode plan's own constraints forbade a `vite.config.ts` change). Practical effect: a synchronous top-level exception in the main app's entry could in principle also abort dune's mount statement, which wouldn't happen with two genuinely separate `<script type="module">` graphs. Parked as negligible risk during the 2026-08-24 dune-mode final review (if the main app's top-level module evaluation throws, the user already has a broken page regardless of dune mode). Revisit via `manualChunks`/`rolldownOptions.output.codeSplitting` only if this ever proves to matter in practice.

### TODO-14: Dune mode's post-connect polish

**Complexity**: S

From the 2026-08-24 dune-mode final review: the departure-transition auto-hide is a fixed timer (not synced to the real connect outcome, by design — see the spec), and a manual browser smoke check (Konami sequence, transition, `localStorage` persistence across reload, toggle-off) was never performed since no browser was available during implementation. Do this smoke check before considering dune mode fully verified.

### TODO-15: Baseline (non-dune) landing-page redesign

**Complexity**: M

A general visual/UX redesign of the landing screen for usefulness and "stickiness," aiming for a more futuristic/minimalist/artistic feel — the piece of the 2026-08-24 dune-mode brainstorming session that was deliberately decomposed out as a separate, not-yet-brainstormed sub-project (dune mode itself is a skin/extension of this baseline, not a replacement for it).

### TODO-16: Multi-server connect + semantic tool comparison

**Complexity**: L

The differentiating idea (2026-08-25 flow-view grill session): connect to several MCP servers at once and semantically compare their tools. The flow view's geometry already accommodates it — N source nodes on the left edge, a shared capability field on the right, semantic clusters receiving provenance-marked traces, so overlap/gaps/unique capabilities become visible as convergence/absence/single-source clusters. `buildFlowModel`'s grouping seam (kind-grouping today, grouping-as-a-function by design) is the extension point; see also TODO-4's single-server semantic grouping. **Monetization note**: like TODO-4, if this becomes a paid feature it needs an entitlement mechanism, which reopens the zero-backend decision (initial design decision #9) — no entitlement machinery until that's a real goal.

### TODO-18: WebGL/shader server core (volumetric gate)

**Complexity**: M

Offered during the 2026-08-26 visual passes and not yet approved: replace the CSS gate ring with a WebGL/GLSL rendering — volumetric light scattering, refraction, a particle field around the core. Requires a real dependency decision (three.js ~150 kB, or hand-rolled GLSL with more code), GPU cost, and `prefers-reduced-motion`/fallback handling; the CSS ring stays the fallback either way. Only pick this up with explicit user approval of the dependency (CLAUDE.md dependency rule).

### TODO-17: Adapt the Dune scene to the stage contract

**Complexity**: S

The flow view introduced `StageProps` (`src/ui/stage.ts`) as the display-variant contract; the Dune scene predates it and runs via its own overlay/entry mechanism. Rendering it as a stage would unify variant switching. Coordinate with (or leave to) the session that owns `src/dune/` — see the isolation rationale in `docs/architecture-overview.md`.

---

## Completed

*(None yet.)*
