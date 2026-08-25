# Dune Mode — Design

**Date**: 2026-08-24
**Status**: Agreed (brainstorming session, all branches resolved)
**Extends**: [`2026-08-24-initial-design.md`](2026-08-24-initial-design.md), [`2026-08-25-visual-identity.md`](2026-08-25-visual-identity.md)
**Participants**: Martyn + Claude

An easter-egg alternate theme: a Konami-code key sequence swaps the whole app into a Dune-inspired look — a heighliner scene with an orbiting galactic entity and ten generative-art tiles on the landing screen, a zoom transition into a URL-seeded procedurally generated ship on connect, and dune-palette tokens applied for the rest of the session (graph, detail panel included).

This spec covers dune mode only. The baseline (non-dune) page redesign for general usefulness/stickiness is a separate, not-yet-brainstormed piece of work.

## Decision log

| # | Decision | Choice | Rejected alternatives |
|---|----------|--------|----------------------|
| 1 | Image sourcing for the orbiting art | Fully procedural/generative SVG art, no AI API calls, no external image files | User-supplied pre-generated images (no image-gen tool available this session); live per-visitor AI generation (no safe place for a paid API key on a public static site, ongoing cost, violates zero-backend spirit) |
| 2 | Scene rendering approach | SVG content + CSS-driven motion (matches existing hand-rolled `Graph.tsx`/`layout.ts` philosophy) | Canvas 2D (harder to keep deterministic/testable, can't theme via CSS custom properties, heavier main-thread cost); pure CSS gradients only (too flat for "spectacular") |
| 3 | Reskin scope | Full session — landing, graph, and detail panel all wear dune tokens until toggled off | Landing + transition only, reverting to default theme once connected |
| 4 | Trigger | Classic Konami code (`↑↑↓↓←→←→ba`), global keydown listener, toggles on/off, persisted in `localStorage` | Typing "dune" into the URL field; a hidden UI glyph |

## Architecture consequences

- **Zero new dependencies, zero backend, zero third-party API.** All generation (art tiles, ship) is deterministic client-side code. Cost: negligible (confirmed per CLAUDE.md's cost-flagging rule).
- **Existing components need no code changes for the reskin.** Because `ConnectScreen`/`Graph`/`DetailPanel` already consume all color via `var(--…)` custom properties (visual-identity spec's theme-ready rule), a second `:root[data-theme="dune"]` token block reskins the whole app.
- **Fully isolated codebase — no shared files edited.** Other work is concurrently in flight against `App.tsx`, `global.css`, `ConnectScreen.tsx`, and `Graph.tsx`. Dune mode is built as a self-mounting side-module in `src/dune/`, loaded via a second, independent `<script type="module">` entry in `index.html` (Vite bundles multiple entry scripts from one HTML file natively — no `vite.config` change needed). It has its own React root (a `<div>` it creates and appends to `document.body` itself), its own stylesheet (`src/dune/theme.css`, never appended to `global.css`), and reaches the rest of the page only through generic, read-only DOM observation (`document`-level `keydown`/`click` listeners, never `preventDefault`/`stopPropagation`) rather than importing or coupling to any component internals. The **only** shared file touched is `index.html`, by exactly one additive line.

## 1. Trigger & state

- A global `keydown` listener, attached by the self-mounted `src/dune/` module directly to `document`, watches for `↑ ↑ ↓ ↓ ← → ← → b a`. Matching the sequence toggles a `duneMode` boolean; entering it again while active toggles back off.
- State persists to `localStorage` under `mcp-explore:dune-mode` so a visitor who finds it keeps it on return, mirroring the existing recents-list persistence pattern.
- Active state is applied as `document.documentElement.dataset.theme = "dune"` (removed entirely, not set to `"default"`, when inactive) — a single DOM attribute drives every visual change via CSS.
- No visible UI affordance advertises the trigger — it's a true easter egg, discoverable only by trying the sequence.

## 2. Theme tokens

A standalone `src/dune/theme.css`, never appended to `global.css`, containing `:root[data-theme="dune"] { … }` and redefining every token name from the default block with dune-direction values. The attribute selector cascades correctly over plain `:root` regardless of stylesheet load order. Exact hex values are draft pending the dataviz re-validation below; direction:

| Token role | Default | Dune direction |
|---|---|---|
| `--bg` | near-black indigo `#07070f` | near-black warm charcoal/brown |
| `--glow-a` / `--glow-b` | indigo / violet, low alpha | spice-amber / deep rust, low alpha |
| `--ink` / `--ink-2` / `--ink-3` | cool indigo-white | warm bone/parchment tones |
| `--tool` / `--resource` / `--prompt` | cyan / amber / violet | spice-amber / sand / deep Fremen-blue |
| `--panel`, `--panel-border`, radii, `--mono`, `--ease-*` | as defined | unchanged (structure, not palette) |

**Before implementation locks the exact hex values**, the new `--tool`/`--resource`/`--prompt` triad must be re-run through the dataviz six-checks validator (lightness band, CVD/normal-vision contrast, contrast ratio) exactly as the original triad was on 2026-08-25 — the visual-identity spec requires this for any accent change, and shape remains the secondary identity encoding (circle/rounded-square/diamond, unchanged) so a palette swap alone can't break accessibility.

No new fonts are loaded — same `system-ui`/`ui-monospace` stacks, keeping bundle size and network requests unchanged.

## 3. Heighliner scene (landing background)

Rendered by `HeighlinerScene.tsx` only when `duneMode` is active, replacing the default two-radial-glow background behind `ConnectScreen`'s content. One SVG composition, viewBox-based like `Graph.tsx`:

- **Back layer** — a large, angular, boxy heighliner silhouette. Fixed shape (not seeded — it's set dressing, not per-URL).
- **Mid layer** — a glowing central "galactic entity" (radial gradient + banded overlay + soft corona blur filter) that the heighliner is orbiting. Slow continuous self-rotation on the banding via CSS `@keyframes`.
- **Orbit ring** — ten `OrbitTile` elements spaced 36° apart on a circle around the entity. Each tile is a clipped SVG viewport containing one of ~5 generative motifs (turbulence-driven "spice storm," layered-wave "dunes," soft dual-glow "twin moons," scattered-dot "starfield," sinuous "worm sign"), palette-rotated across the ten instances so all ten read as distinct. Fixed seeds 0–9 per tile — deterministic, not randomized per load. The ring wrapper rotates glacially (~120s per revolution) with each tile counter-rotated so its art stays upright as it travels (the standard orbiting-moon CSS trick); each tile additionally has its own slow internal gradient/turbulence drift for the "dynamic" feel independent of the orbit motion.

This is a deliberate, called-out divergence from the visual-identity spec's "fixed attachment; no animation" background rule — that rule governs the default theme's background; dune mode is an intentional alternate creative mode where ambient motion is the point. `prefers-reduced-motion` handling (below) keeps it from being a problem for motion-sensitive visitors.

## 4. Submit transition

Trigger, given the isolation constraint (no import/coupling into `ConnectScreen`'s internals): a capture-phase `click` listener on `document`, active only while `duneMode` is on, that fires on the first click on any `<button>` element anywhere on the page. This covers Connect, "Try the demo," and recent-server reconnect uniformly without depending on which one the user chose or on any component's markup — the only assumption is "the landing screen has buttons," which is safe for any web app. The listener never calls `preventDefault`/`stopPropagation`, so it cannot interfere with the real click handler.

On trigger, a capped ~1.5–2s CSS transform/opacity sequence plays: the scene scales/pans toward the heighliner silhouette, crossfades to the seeded ship (section 5), which then animates off-frame. The whole dune overlay (background scene + ship) then auto-hides itself a fixed ~3s after the animation completes, regardless of real connection state — this is deliberately *not* synced to `ConnectScreen`'s actual connect/error outcome (no signal for that is available without coupling to its internals). If the connection is still in progress or has failed when the overlay hides, the (still dune-token-skinned, via section 2) landing screen beneath is simply revealed — a harmless, non-destructive outcome consistent with this being decorative chrome, not a replacement for the real connect flow.

Under `prefers-reduced-motion`, the transition collapses to a ~150ms crossfade directly to the end state.

## 5. Seeded ship generator

`src/dune/shipGenerator.ts`:

```ts
export interface ShipDesign {
  hullArchetype: "sleek" | "blocky" | "finned" | "saucer" | "spike"
  accentColors: string[]      // 2–3 hex values, drawn from the dune hue range
  engineGlow: string          // hex
  greebles: { x: number; y: number }[]   // seeded small hull details
  finCount: number
}

export function generateShip(seed: string): ShipDesign
```

- The `seed` is the connect-target URL. A small FNV-1a-style string hash produces a 32-bit integer, which seeds an inline `mulberry32` PRNG (no new dependency — both are ~10 lines).
- All fields above are derived deterministically from that PRNG stream, same pattern as `computeLayout`'s deterministic polar layout: same URL always produces the same ship, on every load, for every viewer of a shared `?server=` link.
- `ShipSvg.tsx` is a pure presentational component that renders a `ShipDesign` into SVG paths/shapes — no logic beyond drawing, snapshot-testable.

## 6. Testing

- **Tier 1** (`src/dune/shipGenerator.test.ts`): determinism (same seed → identical output), distinct seeds diverge, all numeric fields finite and in-range — same shape as `layout.test.ts`.
- **Tier 1** (`src/dune/konami.test.ts`): the konami-sequence matcher tested as an isolated pure function (full sequence matches, wrong key resets progress, case handling for `b`/`a`), no DOM involved.
- **Tier 2** (RTL): simulated keydown sequence flips `document.documentElement.dataset.theme` and the flag survives a remount via `localStorage`.
- **Tier 3** (Playwright): explicitly skipped. This is a decorative easter egg; smoke-test coverage isn't warranted. Noting this rather than silently omitting it.

## 7. Accessibility & performance

- `prefers-reduced-motion` disables/shortens the orbit ring's rotation and the submit transition (tiles keep their last-frame art; transition collapses per section 4).
- No new dependencies; all rendering is SVG + CSS, no JS animation loop (`requestAnimationFrame`) needed anywhere — CSS keyframes/transforms handle all motion, keeping main-thread cost low.
- Entity-accent contrast re-validated per section 2 before hex values are locked.

## Deferred / out of scope

- Sound design — not requested; flagged as a possible future addition, not building it now.
- The baseline (non-dune) landing-page redesign for general usefulness/stickiness — separate spec, not yet brainstormed.

## Cost

Negligible (<$1/month): no third-party APIs, no new dependencies, no backend, purely static assets served the same way the rest of the app already is.
