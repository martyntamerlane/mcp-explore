# Tool legibility: three zones in the workspace

**Date**: 2026-08-30 · **Status**: built · Closes **TODO-30**. Amends the
tool-first workspace spec
[`2026-08-29-tool-first-workspace.md`](2026-08-29-tool-first-workspace.md) §3.3
and §6.

## 1 · The problem

The subject pane was **one flat stack at one rhythm**: heading, description,
micro-label, fields, button, micro-label, result, disclosure. Seven elements,
all left-aligned at the same x, separated only by whitespace.

Nothing on screen said that *what this tool is*, *what it wants from you*, and
*what it gave back* were three different kinds of thing. So the whole page had to
be read to find any part of it, and the Run button — the one control anybody is
actually looking for — sat at the bottom of a form that can be four arguments
tall.

## 2 · Three zones

**Zone 1 — what this tool is.** An identity strip rather than a bare heading:
the same glyph the browse column draws, lit in the subject's own accent, then
the name, then the facts worth knowing before reading a word — `read only`, and
the argument count. The description below it is **clamped to three lines** with
`Show more`, reusing the measured clamp written for the home view's
`instructions` (TODO-23) and now shared as `ClampedText`. Hugging Face's
`hub_repo_search` opens with a three-line paragraph; deepwiki's are similar.
Clamping is what puts the form above the fold.

**Zone 2 — what it wants from you.** `ARGUMENTS` is now **`INPUT REQUIRED`**,
and the Run button sits on that label's line, right-aligned to the form's own
edge, with the sentence saying why it is disabled beside it. A hairline rule
closes the header, so the fields below read as its contents.

**Zone 3 — what it gave back.** The result is **contained**: a hairline border
all round, `--radius-l`, a faint `--panel-solid` fill, with `RESULT` on its top
edge and the run's clock time and duration opposite. The run history nests
inside it, where it always belonged.

This is a **new visual pattern**, approved 2026-08-30. The tool-first workspace
spec §3.3 says the work surface carries "no card, no frame, no shadow" — that
rule was drawn about the workspace versus the column, and it still holds for the
surface itself. One framed region *inside* it is the exception, and it earns the
exception by answering a question nothing else could: where does the tool's
definition stop and the server's answer begin?

## 3 · Telling the truth in the label

`INPUT REQUIRED` is a lie over a form where nothing is required, so the label
reads **`INPUT`** when every argument is optional. This is not a corner case:
every tool on the built-in demo server is zero-required by design, and Hugging
Face's `hub_repo_search` takes six arguments and requires none of them.

## 4 · Optional arguments, folded

Most tools that *do* mark required arguments are one required and several
optional, and showing all of them at once is what made the form a wall. The
optional ones sit behind a `3 optional arguments` disclosure, borrowing the
browse column's folder language — a chevron, a count, a hairline rail down the
left of what it holds.

**It folds only when there is something required to fold beneath.** The
disclosure exists to demote the secondary fields under the primary ones; with no
primary there is no secondary, and hiding an entire form behind a chevron would
be strictly worse than the wall it was meant to fix.

**It opens itself** when any optional field already carries a value — a restored
run, or a schema default — or when one of them has a validation error. A message
nobody can see is worse than no disclosure at all.

## 5 · Which list am I looking at

The selected segment in the browse column took `--ink` text, a white fill and a
1px shadow: three cues so subtle that on glass they summed to almost nothing, and
the pane gave no quick answer to which of the three lists was on screen.

It now takes **its own kind's accent** — cyan for Tools, amber for Resources,
violet for Prompts — as text colour on a 14% tint with a 30% inset edge, at
weight 500. A segment *is* a selection, and this app's rule is that colour is
earned by selection. It is also the one place the three accents appear together,
which is exactly where they teach what they mean.

## 6 · Audited across all three kinds

Per CLAUDE.md, changing a component's appearance means changing every instance.
Resources and prompts ask for input and give something back in the same shape as
tools, so they take the same three zones: identity strip with the kind's glyph
and a badge (mime type for a resource, argument count for a prompt), the clamped
description, the `INPUT REQUIRED` header carrying `Get prompt`, and the contained
`CONTENTS` / `MESSAGES` region.

Two things fell out of that audit:

- The action button was hard-wired to the tool accent, which put a **cyan "Get
  prompt" on an otherwise violet page** the moment the segment, the glyph and the
  selected row all started carrying their own kind's colour. It now takes the
  subject's accent through a `--accent` custom property.
- A resource's mime type moved from the meta line into a head badge, which left
  `.metaSide` with no callers; it is deleted rather than left behind.

## 7 · Verified

Tier 2: 5 new tests over the fold (present, absent when nothing is required,
self-opening on a seeded value), the identity strip, and the result region being
its own labelled region that does not contain the description. 313 tests pass;
`npm run build` clean.

Headless, light and dark, against the built app: the demo server's tools,
resources and prompts, and live against `mcp.deepwiki.com` (`ask_question` —
`INPUT REQUIRED`, both arguments required, Run disabled with its reason beside
it) and `huggingface.co/mcp` (`hub_repo_search` — `INPUT`, six arguments, none
required, no fold). No console errors beyond Hugging Face's pre-existing 405
transport probe.

**Honest gap:** neither live server marks a tool as having *both* required and
optional arguments, so the fold itself was verified only at Tier 2 and against a
synthetic snapshot — not against a real server's schema.
