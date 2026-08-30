# The result outline

**Date**: 2026-08-29 · **Status**: built · **Session S4** of
[`docs/plans/2026-08-29-interaction-roadmap.md`](../plans/2026-08-29-interaction-roadmap.md)
· Closes **TODO-29**.

> **Amended 2026-08-30** by
> [`2026-08-30-outline-and-wide-blocks.md`](2026-08-30-outline-and-wide-blocks.md):
> the column flexes 200–280px instead of a fixed 200, and now also requires
> the result to run at least half a screen past the fold — three headings
> alone put an outline beside output you could already see all of.
A 50,000-character wiki page was a scroll with no map. `read_wiki_contents` on
`modelcontextprotocol/typescript-sdk` renders **76 headings**; finding one meant
scrolling past the other 75.

This is the direct sequel to the reading pass: the margin it fills is the space
that pass deliberately created (content 780px inside a 1080px subject), so the
outline costs the measure nothing and answers "use the empty space" honestly.

## 1 · Anchors

Outline entries and rendered headings come from **one function**, `parseDocument`
in `parse.ts`, which parses and then stamps each heading with an id in document
order. Two implementations that happened to agree would eventually stop agreeing;
this cannot.

The slugger is total, because headings come from an untrusted server. Anything
that is not a letter or a number is a separator; a heading that survives that as
nothing at all — empty, emoji-only, punctuation-only — is called `section`; ids
are cut to 60 characters with no trailing hyphen; non-Latin letters are kept
rather than erased. Repeats within a document get `-2`, `-3`.

Ids carry a **block prefix** (`b0-`, `b1-`). A result can be several blocks, two
of them can each open with `## Overview`, and two elements sharing a DOM id would
send every outline link to the first one.

Lookup uses `getElementById`, never an attribute selector — ids are derived from
hostile text, and this way nothing needs escaping.

## 2 · When it appears

**Three headings.** Below that they are already on screen together and a list of
them is furniture with nothing to do. Checked against the cases the plan named: a
short `ask_question` answer (3 headings, and the outline earns its place because
the answer is longer than a screen), `read_wiki_contents` (76), a Hugging Face
`SKILL.md` resource (7).

**Above 1380px only.** 780 content + 32 gap + 200 outline = 1012, which fits
inside the existing 1080 subject cap, so the outline never takes a pixel from the
measure — it only spends margin. Below that the margin does not exist and there
is **no substitute**: the page still scrolls, and a drawer would be exactly the
arriving surface this app has repeatedly rejected. Confirmed at 1180 / 1440 /
1920.

**Only while its headings are rendered.** "Show raw" replaces a rendered block
with its bytes, and an outline of links to nothing is worse than no outline, so
it stands down and returns when the block does.

The home view's `instructions` are not outlined — that text has no headings.

## 3 · The mounting trap, recorded

The outline measures the document from its own DOM node. The first version
returned `null` until it had measured something, so it never had a node, so it
never measured, so it never appeared — and it failed silently, on the live site
only, while every unit test passed.

It now stays mounted whenever the result has entries and marks itself
`data-empty` instead, with the media query written as
`.outline:not([data-empty])` — not the `hidden` attribute, which an author rule
on `.outline` would beat.

## 4 · Appearance

Hairlines and type; no card, no fill, in keeping with the workspace's "the canvas
is the ground". Nesting is indent alone, capped at two levels — a second type
size in a five-line list is noise. The active section is a lit left edge in the
tool accent, the same colour language the browse column already uses.

Sticky at the top of the workspace scroller and sized to
`100vh − chrome − padding`, so it fills exactly what is on screen rather than
overhanging the viewport (`--chrome-height`, added here, is now also what the
chrome band's own height is set from — it was a bare `58px` in two places
waiting to disagree).

Scroll-spy is a rAF-throttled scroll listener plus a `ResizeObserver` where one
exists — the observer is what notices "Show raw", which changes the document
without scrolling it.

Clicking owns the jump (`preventDefault` + `scrollIntoView`) rather than letting
a bare hash do it: history belongs to selection (S1), and a hash jump would push
an entry into it.

## 5 · Verified

Tier 1 over the slugger against hostile headings (empty, emoji-only, punctuation,
500 characters, duplicates, non-Latin) and over outline derivation (prefixing,
markdown detection, the threshold). Tier 2 over the component: entries render,
an entry whose heading is absent is dropped, an empty outline stands down without
unmounting, depth is relative and capped, and a click scrolls without touching
the hash.

Live, headless, against deepwiki and Hugging Face: outline hidden at 1180 and
shown at 1440 and 1920 with the content measure at 780px in all three; 76 links
on a wiki page; the sticky column ends exactly at the viewport's bottom edge;
clicking the tenth entry puts its heading at the top of the scroller and lights
it; scrolling on moves the lit entry; "Show raw" stands the outline down and
"Show rendered" brings it back. Light and dark. No console errors.
