# Visual Identity — mcp-explore

**Date**: 2026-08-25
**Status**: Agreed (user direction: "futuristic, moody gradients, very clear styling with more space than text, progressive disclosure to drill down")
**Extends**: [`2026-08-24-initial-design.md`](2026-08-24-initial-design.md) decision #12 (dark-first)
**Amended 2026-08-25**: the graph geometry and step 3 of the disclosure ladder are superseded by [`2026-08-25-flow-view-design.md`](2026-08-25-flow-view-design.md), which also sanctions the trace heartbeat pulse as the one permitted looping animation.

## Direction

Futuristic and moody, not busy: deep layered gradients, restrained glow, generous negative space. **Space beats text everywhere** — labels appear on demand (hover/focus/selection), not by default. Every screen answers one question; detail arrives through **progressive disclosure**, never up front.

## Surfaces

- Background: near-black indigo base `#07070f` with two large, soft radial glows — indigo `#1e1b4b` (top-left, low alpha) and violet `#2e1065` (bottom-right, low alpha). Fixed attachment; no animation.
- Panels/cards: translucent glass — `rgba(255,255,255,0.03)` fill, 1px `rgba(255,255,255,0.08)` border, 16px radius, `backdrop-filter: blur(20px)`.
- Never pure black, never pure white.

## Ink (text tokens — text never wears entity colors)

- `--ink` `#e7e9f4` (primary) · `--ink-2` `#9aa0b5` (secondary) · `--ink-3` `#5d6378` (muted)
- Micro-labels: 11px uppercase, `letter-spacing: 0.08em`, `--ink-3`.

## Entity accents (validated 2026-08-25 — dataviz six-checks, dark mode, all PASS)

| Entity | Fill (marks) | Bright companion (glow/hover only) | Shape (secondary encoding) |
|---|---|---|---|
| Tool | `#0891b2` | `#22d3ee` | circle |
| Resource | `#d97706` | `#fbbf24` | rounded square |
| Prompt | `#8b5cf6` | `#c4b5fd` | diamond |

Validator result: lightness band PASS (L 0.48–0.67), CVD worst-pair ΔE 19.0, normal-vision 27.2, contrast ≥3:1. Identity is never color-alone: shape + labeled hub position always co-encode. Bright companions are decorative (glows, hover rings) and never the sole identity carrier. Colors follow the entity, never state or rank.

## Type

- UI: `system-ui` stack. Identifiers, URIs, schema types: `ui-monospace` stack.
- Hero title thin (weight 200–300), large; body 14–15px; no bold walls.

## Space & motion

- Spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64. Content max-width 1200px. Landing hero starts ~15vh down.
- Motion: 160ms ease-out for hovers, 240ms `cubic-bezier(0.2, 0.8, 0.2, 1)` for panel slide. Deterministic only — no physics, no drag, no infinite animation.

## Progressive disclosure ladder

1. Landing: URL field + Connect + Try-the-demo. Nothing else demands attention.
2. "Add headers" disclosure → header name/value rows + "remember on this device" opt-in.
3. Connected: graph shows **shapes, not text** (hub labels + counts only; leaf labels on hover/focus/selection).
4. Node click → detail panel slides in: name, description, essentials.
5. Panel disclosures: arguments table → "Raw JSON" → resource "Load contents".
6. Connection failure → diagnostic summary, with "Details" disclosure for raw per-transport errors.
