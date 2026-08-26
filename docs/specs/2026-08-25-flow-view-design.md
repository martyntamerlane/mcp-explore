# Flow View — design

**Date**: 2026-08-25
**Status**: Agreed (grill session: paradigm, density, vocabulary, navigation, variants architecture, aesthetic, motion all resolved with user)
**Supersedes**: the radial/polar graph geometry (initial design decision #8's flat ring and the graph portions of [`2026-08-25-visual-identity.md`](2026-08-25-visual-identity.md) §Progressive disclosure step 3). **Retains**: determinism (no physics, no draggable nodes — initial design decision #7), the validated entity palette, surfaces, ink tokens, and the progressive-disclosure ladder everywhere else.

## Why the radial graph is replaced

The structure we draw is a shallow fixed tree: one server → three fixed categories → N unrelated items. Edges carry no information — all information is in names, descriptions, and counts, so layout is judged on readability and reading order. Radial has no reading order, is the worst geometry for labels (our fix was hiding them until hover — exactly what a newcomer can't survive and experts find tedious), and its rings/angles imply meaning that isn't there. Target: someone who has never heard of MCP understands the screen in seconds, without annoying people who already know the protocol.

## Paradigm: left→right signal flow

- **Server node** on the left: name, version, transport. The anchor.
- **Three hairline traces** flow right into three **capability clusters**. Reading order is the reading direction: source → what it offers.
- Cluster headers use **canonical protocol terms** with count (`TOOLS · 12`) and an 11px plain-language gloss beneath: *actions it can perform* / *data it exposes* / *ready-made instructions*. Never rename protocol concepts; never add tours or overlays.
- The flow generalizes to future multi-server comparison: N source nodes on the left, shared capability field on the right (see Deferred).

## Item pills & adaptive density

- Items render as **pills** carrying the entity shape + color coding (validated palette, unchanged).
- **Cluster with ≤ 8 items**: wide pills — name + truncated one-line description. Small servers are fully self-explanatory with zero interaction.
- **Cluster with > 8 items**: compact name-only pills in wrapped columns — a scannable index.
- Threshold is per-cluster and deterministic: the same server always renders identically.

## Readout strip

A fixed strip along the bottom of the diagram prints the full one-line description of the hovered/focused pill. One calm, consistent location; monospace; never a cursor-chasing tooltip; never occludes the diagram. Empty when nothing is hovered (idle hint: "hover an item").

## Navigation: none

No pan, no zoom, no reset. Fit-to-width layout; the page grows downward and **scrolls vertically** for large servers; clusters are collapsible past their header for the largest. Toolbar reduces to the filter box. (Kills the zoom/pan portions of TODO-12.)

## Newcomer layer (complete list)

1. Cluster glosses (above).
2. Landing hero gains one quiet second line: *"MCP is how apps hand tools and data to AI assistants — this shows you what a server offers."*
3. Detail panel humanizes schema types: friendly type names ("text", "number", "list of text", "true/false") with the raw type available alongside, enum chips and Raw JSON disclosure unchanged for experts.

## Aesthetic: precision, not science-props

No instrument decoration (no ticks, gauges, brackets, coordinates). Trust is conveyed by execution: strict spacing grid, traces terminating exactly on pill edges, consistent radii, optical alignment, faint glows carrying meaning only (kind, hover, selection). Surfaces, ink, and entity tokens from the visual identity spec are reused as-is.

## Motion

- **At rest: still, except the heartbeat.** A very faint luminance pulse travels server→clusters along the traces roughly every 4 seconds — the one sanctioned looping animation (deliberate relaxation of the visual identity's no-loop rule, recorded here). Disabled entirely under `prefers-reduced-motion`.
- **In response: one-shot only.** Hover: pill eases up slightly, glow blooms, readout updates. Select: single settle-pulse, then the detail panel slides in with content staggered ~20 ms per element. Filter: matches hold firm; non-matches recede (slight desaturate + shrink), smoothly.
- **On connect: one ceremony.** Traces draw left→right, clusters materialize in sequence, everything settles to stillness. Under ~1 s total, deterministic, honors `prefers-reduced-motion` (instant appearance).
- Timing tokens reused: 160 ms ease-out hovers, 240 ms panel curve.

## Architecture: stages

- The flow view is the **default stage**. A stage is a component with contract `(snapshot, selection, onSelect) → scene`; App owns connection, selection, and shared chrome (header, detail panel). Themed variants (existing Dune scene; future wild ones) are alternate stages behind the same contract — not forks of the app.
- **No universal scene language.** `ServerSnapshot` is the canonical model every stage consumes; per-stage mapping stays thin. Shared, growable derivation helpers only (stable name-hash → visual attributes; grouping; density rules). Extract more only after a third variant exists (rule of three).
- Layout input is shaped `sources[] → groups[] → items[]` from day one — the grouping-function seam TODO-4 asks for, one level up. v1 renders one source, kind-grouping.

## Testing

Tier 1: flow layout math (column wrapping, density threshold, determinism) replaces radial layout tests; schema-humanization mapping. Tier 2: component tests updated for new DOM (readout strip, glosses, collapse, filter recede). Visual polish (glows, pulse) is untested by design.

## Docs impact (same change, not follow-up)

`functional-description.md` (new view behaviour), `architecture-overview.md` (stage interface, module structure), TODO.md (add multi-server semantic-comparison entry with monetization note; add Dune-stage-adaptation entry; prune moot pan/zoom items from TODO-12 with a note; revisit TODO-6 rationale), visual-identity spec gets a pointer note to this file.

## Deferred

- Multi-server connect + semantic comparison across servers (the differentiator; new TODO).
- Semantic grouping within one server (TODO-4).
- Adapting the Dune scene to the stage contract (`src/dune` is owned by a parallel session; do not touch).
- Docs-style list view (TODO-6) — likely obsolete: the flow view *is* readable; revisit only if real usage shows scanning still suffers.

## Amendment — majesty pass (2026-08-25)

User direction after seeing the first build: "plain, boring, like a windows desktop folder… break rules in a stylistic manner that emphasises the majesty of the MCP server components." The restraint dial of §Aesthetic is deliberately turned up; these are the sanctioned rule-breaks:

- **Server core orb** replaces the glass card: a sphere wearing all three entity colors with a layered glow, inside a gravity-well radial wash; it **breathes** (7 s scale loop) — the second sanctioned looping animation after the heartbeat.
- **Conduits, not hairlines**: traces carry an ink→entity-color gradient with a blurred glow underlay; the heartbeat pulse is entity-bright per kind; the selected kind's conduit brightens.
- **Kind-radiant pills**: capsule-shaped, kind-tinted gradient washes and borders, glowing glyphs; wide pills cascade diagonally (16 px per row) echoing the conduit's arrival — deliberately breaking the straight left edge.
- **Ghost numerals**: each cluster's count rendered monumental (76 px, weight 100, ~8% ink) in the right negative space, `aria-hidden`.
- **Per-kind atmospheres**: faint radial color washes behind each cluster; entity-colored hairline rules after headers.

Retained floors: text wears ink tokens only (decoration carries kind, text never does); names never truncate in favor of blurbs; layout stays deterministic; `prefers-reduced-motion` silences every loop and entrance.
