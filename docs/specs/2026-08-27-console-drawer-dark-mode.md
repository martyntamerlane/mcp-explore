# Console drawer + dark mode

> **⚠ Partly superseded (2026-08-29)** by [`2026-08-29-tool-first-workspace.md`](2026-08-29-tool-first-workspace.md).
> **No longer current**: §2's console drawer in its entirety — the tools' deep-dive is now the permanent workspace, so there is no drawer to open, close, or push content up. Esc returns to home rather than closing a drawer.
> **Still current**: dark mode (§3) — the `data-mode` mechanism, the sun/moon toggle, system-follow and the Dune `:not()` guard all stand; only the glow values changed, per the 2026-08-29 spec §7.

**Date**: 2026-08-27
**Status**: Agreed (grill session 2026-08-27 — drawer placement, mechanics, rail side, dark-mode activation all resolved with user)
**Amends**: [`2026-08-26-luminous-deck-redesign.md`](2026-08-26-luminous-deck-redesign.md) §3/§5/§6 (detail panel and its spring retire; run results move to the drawer) and [`2026-08-27-rail-browser-redesign.md`](2026-08-27-rail-browser-redesign.md) §2 (rail returns to the right flank). Executes the dark-mode direction TODO-5 anticipated (light-first with a dark variant).

## 1. Motivation

The right slide-in panel is the last overlay in the app: it "pops from the right", covers content, and after the rail became self-contained it exists only for tools. The user likes the *information* (description, arguments table, run results, raw JSON) but not the vessel. And the luminous identity is light-only; a dark-system visitor gets a blinding first impression.

## 2. The console drawer (tools' new home)

- **`ToolDrawer`**, rendered by `DeckView` **inside the server boundary along its bottom edge** (server-scoped — a future second boundary gets its own drawer). The right slide-in `DetailPanel` is deleted.
- **Push, not overlay**: the deck body compresses upward when the drawer opens; nothing is ever covered. This completes the post-rail grammar: the deck is one surface, everything opens where it lives, no overlays anywhere.
- **Opens** when: a tool's `i` icon is clicked, a run fires (instant click or armed second click — the result lands in the drawer), or an input-required tool's face is clicked. Holds exactly one tool; selecting another swaps content in place.
- **Closes** via ✕ or Esc. Esc precedence: if a tool is armed, Esc disarms first; a second Esc closes the drawer. Disconnect closes it implicitly.
- **Layout**: fixed height ≈ one third of the deck, content scrolls inside; wide columns — identity (mono name, run-class signposting, description) | arguments table (existing `schema.ts` rows: friendly types, required markers, enum chips, defaults) | RUN section (in-flight / result / honest error, `aria-live`, 50k cap line). The raw-JSON disclosure ladder sits with the identity column. Input-required tools keep the honest *inputs required — running these is coming* line in place of RUN.
- **Motion**: one rise, ~250 ms ease-out (choreography moment #3 — replaces the panel spring; the interruptible-reverse requirement retires with it). Instant under reduced motion.
- **Contract**: `StageProps` unchanged — `App` still owns `selection`; `DeckView` renders the drawer from it. `RunProvider`/`ReadProvider` topology unchanged.
- **Rail returns to the right flank** (divider flips to its left edge). It moved left only to escape the old panel's shadow; with no overlays the collision class is gone (ISSUE-3 stays fixed, now structurally). Tools grid left/centre, rail right.

## 3. Dark mode

- **Activation**: follows `prefers-color-scheme` on first visit (and live, via a change listener) until the user makes an explicit choice; a **sun/moon toggle** (app header next to Disconnect; landing top corner) overrides and persists (`localStorage`, `mcp-explore:mode`). Binary light/dark.
- **Mechanism**: `data-mode="dark"` on the root element; a second token block in `src/global.css` re-values the existing custom properties under `:root[data-mode="dark"]:not([data-theme="dune"])`. The `:not()` guard makes Dune win explicitly whenever it is active — no cascade-order gambling with `src/dune/theme.css`, which is untouched. **No new token names** in the first `:root` block (Dune parity contract intact; the dark block only re-values).
- **Identity**: luminous dark, not a grey flip — near-black cool canvas, the same concentrated-light language (hairlines and edges glow slightly *more* than on light), frost becomes dark glass. Entity hues stay the same families; every value is **re-derived and re-validated** with the dataviz six-check validator against the dark canvas (lightness band, chroma, CVD ΔE all-pairs, ≥3:1 contrast); inks invert; `-bright` companions become genuinely brighter than fills on dark (their original meaning). The validated set is recorded in the implementation plan or an amendment here, like the light set was.
- **Scope**: tokens only — landing, deck, rail, drawer, diagnostics all inherit. No component knows about modes except the toggle.

## 4. Accessibility & floors

- Drawer: `role="region"`, labelled by the tool name; close button `aria-label="Close details"`; full keyboard path (tab to `i` → Enter opens, Esc closes); RUN keeps `aria-live`. Focus is not trapped (nothing modal).
- Toggle: real button, `aria-label` states the mode it switches *to*; visible focus ring in both modes.
- Dark palette meets the same AA floors as light (validator for marks; manual check for inks, hairlines, and the danger treatment on dark).
- Reduced motion: drawer rise and any toggle transition swap to instant.

## 5. Verification

- **Tier 1**: mode module (initial resolution: stored > system; persistence; live-follow only without a stored choice).
- **Tier 2**: drawer flow (info opens, fire lands result in drawer, swap between tools, Esc precedence vs arming, ✕, input-required honest state, raw JSON ladder); toggle flips `data-mode` and persists; DeckView/App suites migrated off `DetailPanel`.
- **Screenshots**: both modes × landing / deck at rest / drawer open with result / rail unfolds; Dune regression shot (Konami on, both modes — Dune must look identical in each).
