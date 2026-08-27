# Luminous Deck — baseline redesign (identity + IA + the Run verb)

**Date**: 2026-08-26
**Status**: Agreed (grill session 2026-08-26 — goal, scope, feel, identity, material language, IA, verb scope, click semantics, motion tech, typography, sound, landing, phasing all resolved with user)
**Supersedes**: [`2026-08-25-visual-identity.md`](2026-08-25-visual-identity.md) (the dark identity: surfaces, dark palette values, type ramp) and [`2026-08-25-flow-view-design.md`](2026-08-25-flow-view-design.md) (the left→right flow geometry, traces, readout strip, gate-ring core).
**Retains**: deterministic layout (no physics, no drag — initial design decision #7), entity **hue families + shape coding** (re-derived for light, see §Palette), canonical protocol vocabulary + newcomer glosses, schema humanization, progressive disclosure, the stage architecture (`src/ui/stage.ts` contract), preview-cap and filter behaviour, `prefers-reduced-motion` floors.

> **For the implementing session**: this spec is intentionally self-contained. Read CLAUDE.md first (process, security, WSL dev-server gotcha), then this file end-to-end. Before code: write an implementation plan in `docs/plans/` (CLAUDE.md requires plan-before-implement). Cut a branch from `main` (the checkout may be on a detached HEAD). Territory: **do not touch `src/dune/`** — it is owned by a parallel session; the one coupling point is the token contract in §Palette. Iterate visually: the user judges rendered screenshots, not prose descriptions; after source edits restart `npm run dev` (WSL file-watching is unreliable) before screenshotting.

## 1. Goals

Two goals, in tension, both binding:

1. **Portfolio showpiece** — the first 30 seconds (usually via the demo path) must impress a visitor who has never heard of MCP.
2. **Return-to-play** — an MCP developer with real servers should *want* to come back, because the app is satisfying to use and can actually *run* tools, not just display them.

**Feel target: game-feel, not game-fiction.** No themed world, no metaphors-as-decoration. A calm, fast interface (150–250 ms baseline transitions) with real choreography spent on a small number of key moments (Raycast/Arc school). Explicitly rejected: themed skins (bioluminescent/arcade/reactor fictions), Awwwards-style maximal motion, gamification systems (badges/streaks/achievements).

## 2. Identity: luminous light

Full static redesign. The baseline app becomes **light-first** — bright, airy, premium — deliberately leaving the dark-glow register to the Dune skin (clean separation of the two variants). Dark mode becomes a future variant (TODO-5 inverts).

**Material language: luminous precision.** Near-white layered surfaces; depth and feedback expressed as *concentrated light* — thin glowing hairlines on borders and edges, frosted-glass layers, focus states that ignite like edge-lit instruments. The choreography signature across the whole app is **light travelling through the interface**. Not: heavy drop-shadow materiality, watercolour blooms, or wide soft glows (those wash out on light).

- Surfaces: near-white, never pure white; layered with hairline borders and subtle frost (`backdrop-filter`). Panels read as glass sheets over a bright canvas.
- Feedback: hover = edge lights up faintly; focus = full edge ignition; selection = sustained lit edge + tinted fill; press = light compresses inward. All colour is *earned by interaction* — rest states stay near-monochrome (retained taste rule).
- Texture: the dark theme's film grain was a dark-canvas fix; whether a light equivalent (paper grain at very low opacity) survives is an **open item — judge from screenshots**.

### Palette (derivation required, not prescribed here)

Entity hue families are retained for meaning-continuity — tool = cyan family, resource = amber family, prompt = violet family, shapes circle/square/diamond unchanged — but every value must be **re-derived for light backgrounds and re-validated** with the dataviz validator (six checks: lightness band, CVD ΔE, contrast ≥3:1 against the new light canvas). The dark values in `global.css` today (`#0891b2`/`#d97706`/`#8b5cf6` + bright companions) are calibrated for dark and will not pass on light untouched — expect deeper/inkier fills and the "bright companions" to become "deep companions" (hover/edge tints darker than fill, not lighter). Ink tokens invert to dark-on-light. Record the validated set in this spec's implementation plan or an amendment here.

> **Amendment 2026-08-26 (implementation)**: palette derived and validated — the full table (six-check validator output, canvas `#f4f6fa`, fills `#0891b2`/`#b45309`/`#6d28d9`, deep companions, inks, danger) is recorded in [`docs/plans/2026-08-26-luminous-deck-implementation.md`](../plans/2026-08-26-luminous-deck-implementation.md) §Validated light palette. Notably the existing cyan fill `#0891b2` passed best on light unchanged; cyan-700 failed the chroma floor.

**Token contract (Dune coupling)**: `src/dune/theme.test.ts` scans the **first** `:root` block of `src/global.css` and requires the Dune theme to define every colour token found there. Keep token *names* stable where feasible (change values freely — Dune overrides values). If the light identity needs *new* colour tokens, either (a) coordinate an allowlist/theme.css addition with the Dune session, or (b) place structural non-colour tokens in the second `:root` block (existing pattern — see `--display`). Do not edit `src/dune/` unilaterally.

### Typography

- **Display**: Space Grotesk Variable stays (already self-hosted via Fontsource; it survived three taste passes) — headlines, server name, section titles, large numerals.
- **UI text**: a quiet neutral face for everything small and functional (labels, buttons, body, inputs) — candidate Inter Variable or Geist, **chosen from rendered screenshots**, self-hosted via Fontsource (~50–100 kB asset, no external requests).
- **Mono**: existing `--mono` stack for identifiers, URIs, schema types, results.

### Brand mark: the prism

The app's mark (favicon, landing accent, server-card emblem): an abstract hairline **prism** — one white line in, three tinted threads out (cyan/amber/violet) — the data model drawn as geometry: one server, three capability kinds. Must stay abstract (geometry and light, no literal glass-triangle-with-rainbow kitsch). Resolved-pending-render: draw 2–3 variants, user picks from pixels.

## 3. Information architecture: the control deck

The flow view's geometry (server node → traces → three equal clusters) is **replaced**. Rationale: real MCP servers are tool-heavy — equal billing for three kinds misrepresents reality; and once tools are runnable (§5), the right metaphor is a control surface, not a diagram. The new stage:

- **A named server boundary** — a hairline-bordered card/region containing everything; header carries server name, version, transport chip, and the prism emblem. The boundary is the **multi-server seam**: a future second connection renders a second boundary tiled alongside (supersedes the flow view's N-source-nodes geometry as the TODO-16 growth path). v1 renders exactly one.
- **Tools: the central grid.** Each tool is a **button** — tool name on the face, entity glyph (circle), runnable state visible at a glance (§4). Nicely-organized grid, wrapping; scales via the retained preview-cap pattern ("+ N more" past a threshold per section; an active filter bypasses the cap).
- **Resources & prompts: a flanking rail** beside the grid — compact lists with their glyphs, each entry clickable to the detail panel. Same canonical headers + 11px glosses as before (*actions it can perform* / *data it exposes* / *ready-made instructions*).
- **Adaptive emphasis**: tool-light servers (e.g. a prompts-heavy server) must not render a vast empty centre — the rail may widen / the tools section compress. Exact behaviour judged from screenshots against the test-server list (§9).
- **Filter** stays in the toolbar, filtering across all three kinds; non-matches recede.
- **Detail panel** (existing `DetailPanel`) remains the deep-dive surface: description, humanized schema, raw JSON — plus run results (§5).
- **Retired with the flow view**: `TraceLayer` and conduits, the heartbeat pulse, the gate-ring core, the bottom readout strip. `buildFlowModel`'s data-shaping (`sources[] → groups[] → items[]`, density, dedupe) survives as input to the deck. The deck becomes the **default stage** behind the same `StageProps` contract; Dune remains an alternate.
- **Hover description**: a calm anchored tooltip on the button/entry (fixed position relative to the element, never cursor-chasing) shows the one-line description. This deliberately reverses the flow-view's "readout strip, never tooltips" decision — recorded here as a knowing reversal (grill 2026-08-26).

> **Amendment 2026-08-27**: the rail half of this section is superseded by [`2026-08-27-rail-browser-redesign.md`](2026-08-27-rail-browser-redesign.md) — the rail moves to the left flank as a self-contained browser (resource tree, in-place unfold with auto-load, accordion), rail entries no longer open the detail panel (panel is tools-only), and rail tooltips are retired (descriptions render inside the unfolded row). Tool buttons keep their tooltips and the grid/panel behaviour here stands.

## 4. Interaction contract: tool buttons

Click semantics (grill-resolved, Q13):

| Tool class | Click | Notes |
|---|---|---|
| Runnable, `readOnlyHint: true` | **Runs immediately** | Annotation is untrusted but risk is accepted for read-only-hinted, zero-input tools |
| Runnable, not read-only-hinted (incl. no annotations — unsafe by default) | **Arm, then fire** | First click arms; second fires |
| Input-required (not runnable in this slice) | Opens detail panel | Panel shows schema + an honest "inputs required — running these is coming" state; button face visually distinct (no run affordance) so the differing click semantics are signposted |

**Arm-then-fire**: first click charges the button with light — a luminous fill sweeps across (~150 ms) and holds; label shifts to a confirm form ("Run *name* ▸"). Second click fires. Esc, clicking elsewhere, scroll, or a ~4 s timeout disarms — the light drains back out. Exactly one button may be armed at a time; arming must disarm reliably on blur/panel-open.

- **Hover**: anchored tooltip with the description. **Info icon** (small, on the button): opens the detail panel without running. Keyboard: Enter arms / Enter fires / Esc disarms; every affordance reachable by tab; the armed state announced via `aria` (e.g. `aria-pressed` + live label change).
- **Reduced motion**: fills and sweeps swap to instant state changes; nothing is lost functionally.

## 5. The verb: Run (scoped slice of TODO-1)

- **Eligible**: all demo-server tools, plus any tool on any server whose input schema requires no arguments (no required fields). Form generation for parameterised tools remains **out of scope** (TODO-1 proper); the eligibility check is the clean upgrade seam.
- **Results**: rendered in the detail panel as sanitized text and pretty-printed JSON only. **Everything a server returns is untrusted** (CLAUDE.md security rules): escape at the render layer, never `dangerouslySetInnerHTML`, never eval; cap rendered size defensively. Image/rich content out of scope.
- **Feedback choreography**: press → button acknowledges (light compresses) → in-flight state (edge light circulates on the button) → result lands in the panel with a settle; errors land with a distinct, honest error treatment (no fake success motion).
- **Demo server curation**: add 1–2 tools to `src/mcp/demo/demoServer.ts` whose *results are satisfying to watch return* (e.g. generate structured/visual-ish output, live-feeling data) — the demo path is what every portfolio visitor runs. Design these during implementation.

## 6. Choreography budget

Calm baseline everywhere (150–250 ms, ease-out); expressive choreography **only** at:

1. **Connect — "deck power-on"** (the centrepiece): the server boundary draws itself, then the grid ignites in a staggered cascade (buttons lighting in sequence), rail follows, settles to stillness in under ~1.5 s. Deterministic, one-shot. This replaces the flow view's trace-drawing ceremony.
2. **Arm/fire/result** (§4–5) — the tactile loop.
3. **Detail panel** — spring-based slide with interruptible reverse (dismiss mid-flight reverses fluidly); content staggers in (~20 ms/element).
4. **Expand/collapse & filter** — layout animation for "+ N more" and rail sections; filter recede as before.
5. **Landing entrance** — one confident ambient motion, not ten (§7).

At rest the app is **still** (the flow view's sanctioned loops — heartbeat, breathing — retire with it). `prefers-reduced-motion` silences every entrance and loop, swapping to instant states.

**Motion tech (dependency approved 2026-08-26)**: `motion` (Framer Motion's successor, MIT — verified via npm; ~30–35 kB gz; cost category: negligible). Justification on record: interruptible springs, `AnimatePresence` exits, stagger orchestration, and layout animations are required by the choreography above and are poor hand-rolling targets. Discipline: CSS for all static-state transitions (hover/focus/press); `motion` only for the five moments listed. **Sound: none** (decided; motion carries all satisfaction).

## 7. Landing: two equal doors

Restyled to the new identity, restructured to serve both audiences at a glance:

- **Door 1 — "Connect your server"**: URL input + Connect (structural primacy; it defines what the tool is). Headers disclosure, remember-headers opt-in, recents — all retained.
- **Door 2 — "Explore a live demo — no setup"**: equal visual weight, styled as the *more inviting* of the two (it's the only path a stranger can take).
- The landing does **not** preview the graph (rejected: it would spoil the power-on ceremony, the app's first big payoff). One ambient motion max; the newcomer gloss line stays.
- Recents and error/diagnostic panel (`ConnectError`) restyled to the new identity, behaviour unchanged.

## 8. Accessibility & floors

- WCAG AA contrast throughout on the light canvas (the validator covers entity marks; check ink and hairlines too — luminous edges on light wash out easily, tune deliberately).
- Full keyboard parity for the entire run loop (§4). Armed/in-flight/result states surfaced to assistive tech (`aria-live` where appropriate).
- Identity never colour-alone: shape + position + label co-encode (retained rule).
- Text wears ink tokens only; decoration carries kind, text never does (retained rule).
- No layout nondeterminism: same snapshot → same pixels.

## 9. Verification

- **Tier 1** (Vitest): deck model shaping (grouping, eligibility check for runnable tools, preview-cap math, dedupe), arm-state machine (arm/disarm/timeout/fire transitions), sanitization of results.
- **Tier 2** (RTL): button click semantics per tool class (the §4 table), tooltip/info-icon/panel flows, keyboard paths, reduced-motion swaps.
- **Tier 3** stays TODO-11. Visual polish untested by design.
- **Live QA servers** (re-verify with curl before relying; public servers churn): demo server (primary showcase); `https://mcp.deepwiki.com/mcp` (3 tools); `https://docs.mcp.cloudflare.com/mcp` (2 tools + 1 prompt — the tool-light/adaptive-emphasis case); `https://huggingface.co/mcp` (4 tools + 155 resources — the scale/preview-cap case); `https://gitmcp.io/{owner}/{repo}` (arbitrary supply). Known-bad CORS case for the diagnostic panel: `mcpplaygroundonline.com/*` (ISSUE-1).

## 10. Shipping & process

- **One branch, one reveal** (user decision): no pushes to main until the complete experience — identity + deck + choreography + verb — is done and reviewed. All iteration happens on the dev server. Recommended internal order (dependency-driven, not shipped separately): identity tokens/typography → deck layout → choreography → verb.
- **Docs impact (same change, not follow-up)**: `functional-description.md` (deck behaviour, run loop, landing doors); `architecture-overview.md` (deck as default stage, retired modules, `motion` dependency); TODO.md (TODO-15 executed by this spec; TODO-1 note the slice; TODO-5 inversion; TODO-16 seam change; TODO-18 moot with the gate ring's retirement); `DEPLOYMENTS.md` on the eventual release.
- **Open items resolved during implementation, from rendered screenshots**: neutral UI face (Inter vs Geist), prism mark variant, validated light palette values, grain-on-light keep/drop, adaptive-emphasis behaviour, exact choreography timings, demo tool curation.
