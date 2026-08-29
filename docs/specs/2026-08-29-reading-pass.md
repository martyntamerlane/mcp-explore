# The reading pass — one edge, four voices

**Date**: 2026-08-29 · **Status**: implemented · **Supersedes**: the measure and
markdown-typography decisions in
[`2026-08-29-visual-system-tightening.md`](2026-08-29-visual-system-tightening.md)
§4 and [`2026-08-29-markdown-rendering.md`](2026-08-29-markdown-rendering.md)
§3. Everything else in both still stands.

## 1. What prompted it

User report against the live site, connected to `https://mcp.deepwiki.com/mcp`:
the output on home and in tool results was "too narrow, it should fill the width
of the box", and `read_wiki_contents` had "about 7 or 8 different styles
competing with each other, it makes it difficult to read".

Both were measured before anything was changed. A headless capture at 1440px ran
`read_wiki_contents` against `facebook/react` and collected computed styles off
every visible node in the result:

| count | style |
|---|---|
| 572 | Inter 15 / 400 / `--ink-2` — body |
| 163 | mono 12 / 400 / `--ink-2` — inline code chips |
| 72 | Inter 13 / 400 — table cells |
| 51 | Inter 15 / **700** — bold |
| 49 | **Space Grotesk** 15 / 600 / `--ink` — headings |
| 15 | mono 12 / 700 |
| 13 | mono 12 / 400 / `--ink` — `pre` |
| 7 | mono 12 / 600 |
| 7 | Inter 13 / 600 — table `th` |

Nine styles, three typefaces, three sizes, five weights — the report was
accurate. The widths in the same run: **workspace 1140px, paragraph 594px,
`pre` 650px, table 810px**, with `<hr>` rules running the full 1140.

## 2. Diagnosis

**The width complaint was really a raggedness complaint.** Four right edges
stacked down one page, none of them the container's. The cause is that the
measures were expressed in `ch`, and `ch` resolves against *each element's own*
font-size: `66ch` of 15px prose, `90ch` of 12px mono and `90ch` of 15px table
text are three different widths by construction. A shared edge cannot be
expressed in a font-relative unit.

**Three things did most of the readability damage:**

1. **Inline code chips.** 163 of the ~950 styled nodes in one result are inline
   code, each a tinted pill in a different face at a smaller size. At four or
   five per paragraph the line stops being a line and becomes a chain of boxes.
2. **Headings did not outrank bold text.** All six levels shared `--fs-body` (a
   deliberate decision in the tightening spec), so `**Sources:**` and
   `## Work Loop and Scheduling` rendered at the same size. A 4,000-word
   document arrived with no outline at all.
3. **A third typeface inside the prose.** Space Grotesk appeared only in
   headings — fine in the app's own chrome, where a little text does identity
   work; inside a server's document it is a third voice in a block that already
   had two.

## 3. Decisions

### 3.1 One measure, stated in pixels

`--measure-read: 780px` is the single edge every block in the workspace shares:
prose, `pre`, tables, rules, the argument form and the result blocks. Stated in
px precisely because the failure being fixed was font-relative units diverging.

Rejected: full-bleed to the container (~115-character lines at 1440px — buys the
width by pushing prose past the measure where re-finding the next line starts to
cost), and full-bleed with a 16px body (~105 characters, same problem smaller).
780px is ~95 characters at 15px Inter — above the classic 66–75 comfort band and
knowingly so, because the ragged edges were doing more damage than the empty
space was.

`--measure-form` moved 640 → 780 to match. Two blocks at different widths
directly under one another is the same defect at smaller scale.

`--measure-prose` (66ch) survives for the landing only, whose hero copy is short
and centred.

### 3.2 Four declared voices

| voice | style |
|---|---|
| body | Inter 15 / 400 / `--ink-2` |
| heading | Inter 600 / `--ink`, two tiers: 17px (`#`, `##`) and 15px (`###`+) |
| inline code | JetBrains Mono / **0.92em** / `--ink`, no background |
| block code | JetBrains Mono 12 / `--ink` on `--code-bg` |

Bold is weight alone (600, in the paragraph's own `--ink-2`) — **colour marks
structure, weight marks emphasis**. Matching bold to a heading exactly was tried
first and made the two indistinguishable, which is the original complaint.
`--fs-subhead: 17px` is a new step on the type scale, deliberately taken.

Inline code sizes in `em`, not a fixed step, so it tracks whatever it sits inside
(body, heading, table cell) rather than introducing a third size. This produces
contextual variants — mono at 13.8px in prose, 15.64px in a 17px heading, 600
inside a bold run — which are the same voice adapting to its container, not new
ones.

Tables moved from `--fs-ui` to `--fs-body`, merging with the body voice.

### 3.3 The mono face is pinned

`--mono` was the app's only unpinned family while it carried every tool,
resource and prompt name, every input, every code block and the server name in
the chrome band — the app's dominant texture was a different typeface on every
OS, and no spacing decision in the visual system had been tuned against a face
it could rely on. **JetBrains Mono Variable** (Fontsource, ~40 kB latin subset),
chosen over IBM Plex Mono for its taller lowercase, which is what keeps 12px
inline code legible beside 15px Inter. Closes TODO-22.

### 3.4 Block-level HTML is dropped, its text kept

Deepwiki wraps its source-file list in `<details>` / `<summary>`, which rendered
as literal angle brackets two lines into every result. A line that is nothing
but a tag from a known element list is dropped; a line that is a tag pair around
text keeps the text; a tag inside a sentence stays inert text.

An allowlist rather than a general `<[a-z]+>` pattern: a line of prose reading
`<not a tag>` matches any permissive pattern, and silently deleting a line of a
server's output is a worse failure than printing one stray tag. This is not HTML
support — the parser still emits data with no markup in it, and the security
property is unchanged: no element is ever constructed from a server's bytes.

### 3.5 Instructions clamp

Six lines, then **Show more**. Overflow is measured (`scrollHeight` against
`clientHeight`) rather than guessed from a character count, because the clamp is
a line count and lines depend on the measure, the face and the viewport. Nothing
is discarded. Closes TODO-23.

### 3.6 The two remaining visual picks

**Inter over Geist** (TODO-20.1): every measurement and spacing call in the
tightening spec was made against Inter, and Geist's differences at 13–15px are
not worth re-tuning a scale that was just tuned. `@fontsource-variable/geist`
uninstalled.

**Prism variant "b"** (TODO-20.2) — the closed triangle — is now the default in
`Prism.tsx` and the app's first favicon, inline in `index.html` as a data URI
with a `prefers-color-scheme` swap for dark tab strips. At 16px the open
triangle of "a" and the bare hairline of "c" both collapse into indistinct
scratches; a closed outline is the only one of the three that survives.

**Grain on light stays dropped** (TODO-20.3): the luminous canvas gets its life
from the gradient, and adding texture under a page that just became denser works
against §3.1–3.2. Revisit against the new composition if it still feels flat.

## 4. Verified

Rebuilt and re-measured with the same headless sweep against the production
build (`vite preview`), deepwiki and Hugging Face, light and dark:

- **Widths**: paragraph 780 / `pre` 780 / table 780 in a 1140 workspace — one
  edge, down from four.
- **Styles**: nine independent styles → five (body, two heading tiers, bold,
  inline code) plus three contextual mono variants.
- Browse column still 300px on Hugging Face (ISSUE-5 stays fixed).
- Instructions clamp 148.5px → 396px on expand; **Show more** present on Hugging
  Face, absent where instructions are short.
- 208 Vitest tests pass; no page errors in any capture.

## 5. Not done

The rest of TODO-24 (reference links, setext headings, footnotes, task-list
checkboxes) is untouched — no evidence a real server needs them. `--measure-read`
is a fixed px value and does not yet respond to viewport width; at 1180px the
workspace is narrower than 780 and the cap simply stops applying, which is
correct, but a genuinely wide 2560px display gains nothing from the extra room.
Revisit if anyone reports it.
