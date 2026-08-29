# Addressable selection + keyboard navigation

**Date**: 2026-08-29 · **Status**: built · **Session S1** of
[`docs/plans/2026-08-29-interaction-roadmap.md`](../plans/2026-08-29-interaction-roadmap.md)
· Closes **TODO-25**, and the navigation half of **TODO-26**.

Two questions asked twice — "how do I get to a thing?" — so they were built
together: a selection you can link to, and a selection you can reach without a
mouse.

## 1 · Selection in the address bar

`?server=<url>&tool=NAME`, `&resource=URI`, `&prompt=NAME`. One parameter names
the kind, so a link is self-describing.

**Ignorable garbage.** No kind parameter, an empty one, or *two* of them all
read as home. Two subjects have no honest reading, so the link opens the server
rather than guessing. A name the server does not expose also resolves to home —
a stale share should open the server, not show a visitor an error about a name
they never typed — and the stale parameter is replaced out of the URL so it is
not re-shared.

**Push vs replace.** `pushState` for a user-initiated selection (that is what
gives Back/Forward something to walk), `replaceState` for anything the app
decided on its own: connecting, auto-connecting, cleaning a stale link,
disconnecting. Re-selecting the current subject — which is how a zero-argument
tool is re-run — pushes nothing; it is not a new place.

**A deep link opens, it does not run.** Selecting a zero-argument tool from the
column runs it; arriving at one by link does not. A URL someone else wrote must
not fire a call the visitor never asked for.

**A selection belongs to its server.** The link's selection is applied only when
the connected URL matches the link's `?server=`, so a stale subject is never
inherited by a different server or by the demo.

**Encoding.** Values are percent-encoded by hand rather than through
`URLSearchParams`, which renders spaces as `+` and escapes the slashes in a
server URL; the `?server=` form predates this work and links already exist.

**Resource URIs stay URIs.** The roadmap flagged that percent-encoded `hf://`
URIs might get silly enough to want an index instead. Measured against Hugging
Face: `?server=…&resource=skill://hf-cloud-python-env-setup/scripts/check_versions.py`
is a 143-character link. Ugly-but-stable beats an index that breaks the moment
the server reorders its list. Keep the URI.

## 2 · The key model

| Key | Effect |
| --- | --- |
| `/` | Focus the chrome band's filter, from anywhere outside a text field |
| ↑ ↓ | Move a **highlight** through the visible rows |
| ⏎ | Commit the highlight — select it, or fold/unfold a folder |
| → ← | Unfold / fold the highlighted folder |
| Esc | Clear the filter if it has text; otherwise return home |

**Highlight, not selection.** ↑↓ move a highlight and ⏎ commits it, rather than
selecting as they move. Resolved against the Hugging Face case as the roadmap
required: selecting per keystroke would push a history entry and fire a read for
every row passed on the way to one — which would break the Back button this same
session exists to deliver.

**Nothing steals a keystroke from a tool's arguments.** Inside an input,
textarea or select, every one of these keys belongs to the field — except Esc,
which kept its existing global meaning. The filter is the deliberate exception:
it is this list's own control surface, so ↑↓⏎ act on the list from inside it
while ←→ stay with the text caret and `/` types a slash. Focus never leaves the
filter, so you can keep typing between moves. A focused row button keeps ⏎ for
its own native click, so the two handlers never fight.

**Clamped, not wrapping.** In a 155-row list, wrapping from the end to the start
reads as a glitch. Movement skips rows the filter has receded.

**The highlight follows the pointer.** A click or a deep link moves the
highlight to the selected row, so ↓ continues from where you actually are.
Switching segment drops it — a different list is a different place.

## 3 · What the column does on arrival

A deep link to a resource used to open its subject in the workspace while the
column sat on the Tools list showing nothing. On arrival the column now opens on
the **kind of the selection**, and unfolds the folders on the path down to it.
Only the initial value follows the selection: clicking a tool while browsing
Resources must not yank the list out from under the next click.

## 4 · Appearance

The highlight is the ring the browser would have drawn for focus, drawn by the
app instead — because selection deliberately does not move focus (tool-first
workspace spec §3.2). Same treatment as `:focus-visible`, one step weaker than
`aria-current`, so "where I am" still outranks "where I am pointing". No new
visual pattern, and none of S2's keycap glyphs: `/` is advertised only as
`aria-keyshortcuts` on the filter until shortcut legibility is designed.

## 5 · Where it lives

Two pure modules carry the decisions, so both are tested as functions:

- `src/ui/selectionUrl.ts` — parse, build, resolve-against-snapshot, compare.
  `App` owns the History calls; this owns what the strings mean.
- `src/ui/deck/keynav.ts` — flatten the visible rows, move the highlight, decide
  what a keystroke means, find the folders above a leaf.

`BrowseColumn` binds them to events. `DeckView` no longer listens for Escape;
the column owns the whole key model, Escape included, because Escape now unwinds
the filter before the subject.

## 6 · Verified

Tier 1 covers URL round-trips and the ignorable-garbage cases, and the key model
end to end. Tier 2 covers deep links, Back/Forward, and every key against the
demo server. Live, headless, against `mcp.deepwiki.com` and `huggingface.co/mcp`:
deep link opens its subject; Back/Forward walk the selection; reload holds; a
resource three folders deep is reachable by keyboard alone and its link survives
a cold load with the folders unfolded and the row scrolled into view. No console
errors beyond Hugging Face's pre-existing 405 transport probe.

## 7 · Not done here

Command mode and the keycap glyphs are **S2**. `>` does nothing yet.
