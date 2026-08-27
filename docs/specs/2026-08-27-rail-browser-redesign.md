# Rail browser — resources & prompts become a self-contained browser

**Date**: 2026-08-27
**Status**: Agreed (grill session 2026-08-27 — placement, tree ambition, load semantics, accordion, tooltip fate all resolved with user)
**Amends**: [`2026-08-26-luminous-deck-redesign.md`](2026-08-26-luminous-deck-redesign.md) §3 (rail geometry, hover-description tooltips on rail entries) and §4 (detail-panel scope). Everything else in that spec stands.

## 1. Problems observed (from rendered screenshots, 2026-08-27)

1. **Rail tooltips cover the rail.** The anchored hover tooltip on a resource/prompt entry opens *below* the entry and sits on top of the next entry or the next section header. On top of that, the tooltip shows on `:focus-within`, so after a click it stays pinned until focus moves — the "helptext doesn't disappear" bug.
2. **The detail panel buries the list it came from.** Clicking a rail entry slides the panel over the entire rail; browsing resources means click → covered → close → click. The panel also intercepts pointer events over the rail while open. For the thin payoff (URI, mime type, a "Load contents" button) the trip isn't worth it.

Root diagnosis: the rail treats resources and prompts as mini tool-buttons — same card, same tooltip, same panel — when they are *browsable content*, not verbs.

## 2. Design

> **Amendment 2026-08-27 (same day)**: the rail returns to the **right** flank per [`2026-08-27-console-drawer-dark-mode.md`](2026-08-27-console-drawer-dark-mode.md) — the left move existed to escape the right slide-in panel, which that spec deletes outright (tool info moves to a bottom drawer; no overlays remain). Everything else here stands.

### The rail becomes a self-contained browser (left flank)

- The rail moves to the **left flank** of the deck body (file-browser convention: navigator on the left); the tool grid takes the centre/right. The detail panel now slides in over the grid's side and **never covers the rail**.
- Rail entries no longer open the detail panel and no longer participate in `selection`. The panel is **tools-only** — it earns its keep there (schema, run results). `ResourceView`/`PromptView` are deleted.
- The `StageProps` contract is unchanged (rail simply stops calling `onSelect`).

### Resources: a real tree, thresholded

- Resource URIs are parsed into a folder tree (`scheme://a/b/name` → folders `a/`, `b/`). A folder is only materialised when it groups **≥ 2 entries**; single-child chains collapse into the parent path. Servers with flat URIs render exactly as flat rows — the tree is earned, not imposed.
- If all resources share one URI scheme the scheme is not shown as a folder (noise); mixed schemes become top-level folders.
- Folders are cheap disclosure — several may be open at once; open state is local and not persisted.
- Prompts have no URIs and stay a flat list.

### Rows unfold in place; unfolding loads

- A leaf row at rest: entity glyph + name (+ chevron). **No hover tooltip** — the rail tooltip is retired; the description renders inside the unfolded row. (This partially re-reverses the luminous-deck spec's §3 tooltip decision — recorded there as an amendment. Tool buttons keep their tooltips.)
- Clicking a row unfolds it in place. **Unfold is the load request**: resources call `readResource` immediately (slim in-flight state, then content lands inline); zero-argument prompts call `getPrompt` and show the actual message text. Loaded content is cached for the session — re-unfolding is instant.
- Unfolded resource row shows: description, URI + mime type as quiet metadata, then contents — mime-aware pretty-printing (JSON), images from base64 blobs, honest "binary — not rendered" for other blobs, capped at `MAX_RESULT_CHARS` with an honest cap line. Everything a server returns is untrusted: React text nodes only, no `dangerouslySetInnerHTML`, no eval (CLAUDE.md security rules; `data:image/*;base64` URIs only for images).
- Unfolded prompt row shows: description, the argument list (name, required marker, description), and for zero-argument prompts the fetched messages (role-labelled). Parameterised prompts show an honest *"fill-in preview — coming with tool forms"* line (mirrors the tools' input-required stance).
- **Accordion**: exactly one leaf row open per rail at a time — unfolding a row folds the previous one (matches the "exactly one armed button" discipline; a 50k-char content block × several open rows would make the rail a scroll marathon). Folders are exempt.
- Read errors land in the unfolded row with the same honest error treatment as run errors (no fake success motion).

### Behaviour retained

- Filter recede works on leaf rows; while a query is active all folders are forced open so matches are visible, and preview caps are bypassed (existing filter contract).
- Preview cap (`RAIL_PREVIEW_MAX`) applies to **top-level rows** (a folder counts as one row) — the HF 155-resource case now scans as a handful of folders instead of a wall of names.
- Canonical section headers + glosses, empty-state "none", power-on cascade order (grid then rail) all unchanged.
- Expand/collapse animates under choreography moment #4 (layout animation); reduced motion ⇒ instant.

### Tool-button tooltip fix (bug, not redesign)

Tool buttons keep the anchored tooltip (they have nowhere to unfold to), but it currently pins after a mouse click because visibility is tied to `:focus-within`. Fix: show on `:hover` and keyboard focus only (`:has(:focus-visible)`), so pointer clicks never pin it. Logged in ISSUES.md with root cause.

### Demo curation

The demo server gains path-structured resources (`demo://docs/…`, `demo://issues/…`) so the tree — the new rail's showcase — is visible on the portfolio path, not just on HF-scale servers.

## 3. Accessibility

- Folder rows: `aria-expanded`; leaf rows: `aria-expanded` (replacing `aria-pressed` selection semantics); unfolded content is plain in-flow DOM (no focus trap), in-flight/landed states via the existing `aria-live` pattern.
- Keyboard: rows are native buttons — Tab/Enter parity for the whole browse loop; Esc is not claimed (nothing modal is open).
- Identity stays shape+position+label coded; text wears ink tokens only.

## 4. Verification

- **Tier 1**: `railTree` shaping (threshold, chain-collapse, scheme handling, flat fallback, dedupe interplay), `readResult` formatters (narrowing, prettify, caps, image/binary branches, error shapes).
- **Tier 2**: rail unfold flow (accordion, auto-load, cached re-open, error state), prompt zero-arg vs parameterised, filter-forces-folders-open, panel no longer opens from rail, tools-only panel guard.
- Live QA: demo (tree showcase), HF (155-resource tree at scale), cloudflare (tool-light + prompts), deepwiki (flat URIs ⇒ flat rows).
