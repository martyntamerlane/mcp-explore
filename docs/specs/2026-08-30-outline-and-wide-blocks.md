# The outline's width, when it appears, and what fills the space it leaves

**Date**: 2026-08-30 · **Status**: implemented · **Amends**:
[`2026-08-29-reading-pass.md`](2026-08-29-reading-pass.md) §3.1 (one shared
edge) and [`2026-08-29-result-outline.md`](2026-08-29-result-outline.md) (when
the outline shows). Both stand except where noted below.

## 1. What prompted it

User report against the live site on `read_wiki_contents`: *"why is the far
right panel showing the 'on this page' content, have such a narrow margin, when
there's so much space to the right of it on my screen"*.

Measured before anything changed, on that exact URL, after running the tool:

| viewport | workspace | subject row | outline | empty band right of the outline |
|---|---|---|---|---|
| 1440 | 1140 | 1075 | 200 | 95px |
| 1920 | 1620 | 1080 | 200 | **575px** |
| 2560 | 2260 | 1080 | 200 | **1215px** |
| 3440 | 3140 | 1080 | 200 | **2095px** |

The outline's edges sat at x=1145 and x=1345 at *every* width above 1440 — the
column does not move. Inside it, 22 of 49 entries wrapped onto two lines.

The reading pass had already predicted this in its own §5: *"a genuinely wide
2560px display gains nothing from the extra room. Revisit if anyone reports
it."*

## 2. Diagnosis

Two fixed pixel values with nothing between them and the viewport: an outline of
`flex: 0 0 200px` inside a row capped at 1080px. Both are correct at the 1440px
screen they were tuned on and nowhere else. See ISSUE-16.

## 3. Decisions

### 3.1 The outline flexes between a floor and a ceiling

`--outline-width` is 280px, `flex: 0 1` with a `min-width: 200px`. Wrapping falls
from 22 of 49 entries to 6, and 21 entries fit the screen instead of 14. Widths
were measured rather than guessed:

| list width | entries wrapping | middle panel |
|---|---|---|
| 200 (before) | 22 of 49 | 780 |
| 260 | 8 of 49 | 780 |
| **280** | **6 of 49** | **780** |
| 340 | 1 of 49 | 780 |
| 400 | 0 of 49 | 780 |

Stopped at 280 because the middle panel must keep the majority of the focus —
the outline is an aid, not a peer. Past 300 the remaining wraps are genuinely
long headings and each one bought costs real balance.

**The measure never pays for the margin.** 780 + gap + 280 does not fit at 1440,
which is precisely where the reading column must not be the one to give way. So
above the outline's breakpoint `.content` stops shrinking and the outline
absorbs the shortfall down to its floor: 203px at 1380, 263 at 1440, the full
280 from about 1520 up. Verified at all four widths.

### 3.2 The outline appears only when there is something to be saved from

Three headings was the old bar, which put a navigation column beside output you
could see all of at once. It now also requires the result to run at least **half
a screen past the fold** (`SHOW_AT_SCREENS = 1.5`).

Two thresholds, not one: it stays until below 1.35 screens. Hiding the outline
widens the blocks below it (§3.3), which makes the content *shorter* — so a
single threshold would decide using a height its own decision changes. Widening
never makes content taller, so this cannot actually oscillate; the gap removes
the question rather than leaving it to be reasoned about later. Verified stable
across eight idle samples and a nine-step resize sweep.

### 3.3 A second edge, for blocks that are not running text

This is the amendment to the reading pass. `--measure-block` is the reading
measure everywhere except a result with no outline beside it, where it becomes
`min(100%, 1200px)`. It is taken by the result's framed panel, markdown tables,
markdown code blocks and the raw view — **never by running text**.

Rejected: full width for everything, which is what the report literally asked
for. Measured on the same result, at 15px Inter:

| text column | characters per line |
|---|---|
| 780 (today) | 104 |
| full width @ 1920 | **209** |
| full width @ 2560 | **263** |

Against a 66–75 comfort band, and against the reading pass's own rejection of
full-bleed at ~115. The earlier "it should fill the width" report was diagnosed
then as a *raggedness* complaint, and that diagnosis still holds: the fix was one
shared edge, not more width.

Rejected: centring the row in the workspace. It balances the margins by opening
a dead gutter between the browse column and the content it controls, which reads
worse than the trailing space it removes.

So the reading pass's "one edge" becomes **one edge for prose, one for framed
blocks, and only when the margin is otherwise empty**. That is not the defect the
reading pass fixed — that was four *accidental* text edges produced by `ch` units
resolving against different font sizes. This is one deliberate edge on bordered
objects.

A detail found by looking rather than reasoning: widening the panel while leaving
the raw code block inside it at 780 put an empty half-panel to its right, which
looked worse than the margin it replaced. The block follows `--measure-block`
too.

### 3.4 The pair is centred; the lone column is not

Added the same day, after §3.1 shipped and the report came back as *"the
rightmost pane still looks off"* (ISSUE-19). Making the outline legible had not
made it look placed: at 1920 it sat 32px from the text it indexes and 495px from
the edge of the screen.

With an outline the row is a **pair**, and a pair reads as composed only when its
margins match, so the row centres itself. It is a no-op where nothing was wrong —
at 1380 and 1440 the pair already fills the workspace (33/32 measured) — and acts
only above the width where the cap starts binding: 265/264 at 1920, 585/584 at
2560, 1025/1024 at 3440.

Without an outline the row stays left-anchored. The single column has already
widened to take the space (§3.3), and centring it as well would unmoor the
reading text from the browse column it belongs to.

Rejected, by rendering all four against the live result rather than arguing them:
pushing the outline to the right edge (495px hole in the middle of the page) and
letting the gap grow to a cap (440px hole, same defect smaller). Both trade an
uneven margin for a gap between the index and what it indexes, which is worse.

## 4. Verified

Against the production build (`vite preview`), deepwiki and the in-page demo, at
1380 / 1440 / 1920 / 2560:

- Long result (28 screens): outline present at 203 / 263 / 280 / 280; reading
  column 780 at every width; blocks stay at the shared edge.
- Short result (1.26 screens): no outline; panel and code widen to 1200.
- No oscillation across eight idle samples or a nine-step viewport-height sweep.
- 367 Vitest tests pass.

## 5. Not done

**Mobile.** Deferred by decision the same day. The workspace has no mobile form
at all — the browse column's fixed 300px leaves 90px beside it on a 390px phone,
where a tool name renders one character per line vertically. Nothing in this
spec improves or worsens that: the reading cap already stops applying below its
own width, and the wide-block behaviour is desktop-only. See ISSUE-17 and
TODO-32. The landing page needs nothing.
