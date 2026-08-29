# Visual system tightening — design

> **Partly superseded 2026-08-29** by [`2026-08-29-reading-pass.md`](2026-08-29-reading-pass.md):
> the `ch`-based measures in §4 became one px measure (`--measure-read: 780px`), and
> the one-size-for-all-heading-levels rule became two tiers. The scale, the
> single-column result, the browse-column fix and everything else here stand.

**Date**: 2026-08-29 (after the tool-first workspace shipped and went live)
**Status**: implemented
**Refines**: [`2026-08-29-tool-first-workspace.md`](2026-08-29-tool-first-workspace.md) and the identity in [`2026-08-26-luminous-deck-redesign.md`](2026-08-26-luminous-deck-redesign.md). Supersedes nothing — every decision in those specs stands. This adds the type/space layer they assumed and never wrote down, and corrects five places where the built UI diverged from their own intent.

## 1. Why

A measured audit of the live site (headless capture at 1180/1440/1920, light and dark, plus the Hugging Face scale case, with computed styles collected off every visible node) found the app had no scale:

| System | Measured, before | After |
|---|---|---|
| Font sizes | **13** — 10, 11, 12, 12.5, 13, 13.5, 14, 15, 16, 19, 21, 26, 46 | **7** |
| Distinct spacing values in CSS | **27**, incl. 5, 9, 11, 13, 22, 26, 34, 44 | 4px scale |
| Border radii rendered | **6**, incl. a rogue `0` | **5** (4 roles + the circular toggle) |
| Letter-spacing for one "small caps label" role | **5** — 0.32 / 0.22 / 0.12 / 0.12 / 0.06 em | **2** |
| Type families rendered | **4** — one of them unintended | **3** |

Five sizes (12, 12.5, 13, 13.5, 14) sat inside a 2px band: too close to read as hierarchy, far enough apart to make vertical rhythm impossible. `--radius-s/m/l` already existed but were applied per *screen* rather than per *role* — the landing's input and button were `--radius-m`, the workspace's were `--radius-s`.

## 2. Decisions

1. **A written scale, in tokens.** Seven type steps, a 4px spacing scale, two tracking values, three measures. A size off the scale is a bug.
2. **Radius means role, not screen.** Pill for status chips and nav switches; `--radius-s` for inputs and buttons *everywhere*; `--radius-m` for rows, cards and code blocks; `--radius-l` for the landing doors alone.
3. **Identifiers are always mono.** Tool, resource, prompt and folder names, the server's name in both places it appears, and the tool name inside the Run button.
4. **One pattern per control type.** One segmented control, one row shape.
5. **The result lands where you acted**, not in a reserved column across the page.
6. **The primary door carries the primary treatment.**

### 2.1 The tokens

All of them live in global.css's **second** `:root` block. The dune theme-parity test (`src/dune/theme.test.ts`) scans only the first block and demands a dune equivalent for everything it finds there; structural tokens belong in the second, alongside `--display`/`--ui`.

```
--fs-micro  11px   uppercase micro labels, chips, badges, type hints
--fs-fine   12px   fine print: field descriptions, code, meta, quiet notes
--fs-ui     13px   controls: rows, buttons, inputs, segments
--fs-body   15px   prose: descriptions, instructions, subtitles
--fs-title  21px   the subject's name; the landing's door titles
--fs-figure 26px   the home view's count numerals
--fs-hero   46px   the landing headline

--sp-0..8   2 / 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64px   (2px is for hairline insets only)

--track-label     0.12em   uppercase micro labels, count labels
--track-wordmark  0.24em   MCP EXPLORE, wherever it appears

--measure-prose    66ch    prose was running at 82 characters per line
--measure-form     640px
--measure-subject  1080px
```

**Micro labels vs chips.** Uppercase + `--track-label` marks a *micro label* (ARGUMENTS, RESULT, CONTENTS, INSTRUCTIONS, the count labels, and now an argument's type). Chips and badges (`v1.0.0`, `in-memory`, `read only`) stay as written, untracked. That distinction is why the `read only` badge lost its 0.06em rather than gaining the label tracking.

**The hero's weight 300 is kept.** It is the app's only 300 and its only piece of display typography; at 46px the light cut is the point. Noted here so it reads as a decision rather than drift.

## 3. Ink

`--ink-2` was `#4d5468` (6.7:1 on `--bg`) against `--ink-3`'s `#5a6070` (5.5:1) — an 18% luminance step, so the primary/secondary hierarchy the two greys encode was not visible, and a form's label, type and description were effectively one flat grey. Darkened `--ink-2` to `#3d4356` (**8.6:1**) rather than lightening `--ink-3`, which carries 11px uppercase labels and must stay legible. The light ramp is now 15.0 / 8.6 / 5.5:1, roughly 1.7× per step. Dark mode's ramp (15.5 / 8.25 / 5.2) already had the step and is untouched.

## 4. Layout

**The tool and prompt views were a two-column grid whose result track was weighted larger than the inputs** — `minmax(280px, 1fr) / minmax(300px, 1.15fr)`. An un-run tool therefore spent half the workspace on one grey sentence, ~950px to the right of the last input at 1920px wide, and roughly 60% of that viewport was empty. Replaced by a single column: form (capped at `--measure-form`), then Run, then the result, then the raw-JSON disclosure. You act and the answer appears under your hand.

**Output blocks are sized to a reading width** (`max-width: 90ch`), not to the viewport. Eight lines of JSON used to be stretched across a 1485px slab.

**The browse column's width was data-dependent.** Declared `flex: 0 0 300px`, it measured **370px** on Hugging Face: a flex item's `min-width` defaults to `min-content`, so long resource names pushed it out and re-proportioned the whole app per server. `min-width: 0` holds it at 300.

## 5. Components

- **The segmented control** (`one of`, `true/false`) was the only square-cornered, hairline-divided control in the app. It now uses the pill group the browse column's kind switch already established — same inset, same radius, the tool accent standing in for that control's neutral selection.
- **Folder rows** dropped the card entirely (`background: none`, transparent border) while leaf rows were pills, so a resource-heavy server rendered an all-flat list next to Tools' all-pill one — the two tabs read as different applications. Folders keep the card and recede by fill.
- **Inputs**: a 10%-alpha border on a near-white fill over a `#eaf0f8` canvas read as a faint smudge rather than a field. Now `color-mix(in srgb, var(--ink) 18%, transparent)`, which carries in both modes because `--ink` flips.
- **Disabled buttons** are a flat neutral control (`--ink-3` on `--panel-border`, no fill), not a 45%-opacity ghost — the old treatment washed the accent out of the landing's primary door. The workspace's Run button already did this; the landing's Connect now matches.
- **`<code>` and `<pre>`** carry a UA `font-family` that beats inheritance, so a bare `<code>` — the resource URI — was silently rendering in the browser's generic `monospace`: a fourth face, different on every OS. Pinned to `--mono` globally.

## 6. The landing (TODO-19)

The landing inverted its own priority: the demo door carried the tinted wash, the lit hairline and the prism, while "Connect your server" — what the app is for — was a plain box with a greyed-out button.

- The CTA treatment and the prism move to the **Connect** door; the demo door becomes a calm secondary with a neutral button.
- Both doors are left-aligned with the same structure (title, sub, control) and centre their contents vertically, so the shorter one has balanced air instead of a dead foot. The Connect door gains a one-line sub that states the actual differentiator: *"Any CORS-enabled MCP server. It connects straight from this tab — no backend, nothing stored."*
- The hero is centred in the viewport. At `12vh` top padding the whole landing finished about 40% up a 900px window with nothing below it.
- The two stacked greys under the headline were the same size and nearly the same colour, reading as one paragraph. The gloss is now sized and coloured as the footnote it is.

## 7. Not done here

- **Pinning `--mono` to a webfont.** It is the only unpinned face — `ui-monospace, SF Mono, Cascadia Code, Menlo, Consolas` — so the identifier texture, which is most of this app's surface, differs per OS. Fixing it means a new dependency (~30 kB subset) and is a call for the user, not a tidy-up. See TODO-22.
- **Clamping long server `instructions`.** Hugging Face's is a 24-line wall even at 66ch. A "show more" is a new interaction and needs its own decision. See TODO-23.
- **The third visual pick.** TODO-20's Inter-vs-Geist question is untouched; `@fontsource-variable/geist` is still an unimported dependency.

## 8. Verification

Rebuilt and re-measured against the production build with the same headless sweep across landing / home / tool / result / resource / prompt, light and dark:

```
FONT SIZES (7): 11, 12, 13, 15, 21, 26, 46
TRACKING   (3): 0.24em@11px, 0.12em@11px, -0.015em@46px (the hero's optical kern)
RADII      (5): 8px, 12px, 16px, 999px, 50% (the circular mode toggle)
FAMILIES   (3): Inter Variable | Space Grotesk Variable | ui-monospace
Hugging Face: nav 300px (was 370), prose 71 chars/line (was 82)
```

Tier 1 + 2: 158 tests pass, unchanged. No console or page errors in any captured state.
