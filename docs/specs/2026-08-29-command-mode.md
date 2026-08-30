# Command mode and shortcut legibility

**Date**: 2026-08-29 · **Built**: 2026-08-30 · **Status**: built · **Session S2** of
[`docs/plans/2026-08-29-interaction-roadmap.md`](../plans/2026-08-29-interaction-roadmap.md)
· Closes the rest of **TODO-26**, on top of
[`2026-08-29-addressable-selection.md`](2026-08-29-addressable-selection.md).

S1 made every action in the browse column reachable from the keyboard. S2 makes
every action in the *app* reachable, and — the half that is not plumbing — makes
the keys visible to somebody who was never told about them.

## 1 · Why there is no ⌘K overlay

Every source consulted in the 2026-08-29 research pass points at the same
pattern: a modal palette that fades in over the workspace on ⌘K. It is rejected
here, and the rejection is the design.

This project has twice decided that **surfaces which arrive are worse than
furniture that changes**: the console drawer became a permanent region, and the
detail panel became a permanent workspace. A palette that flies in over the
column is the archetype of the thing both of those decisions moved away from.

So command mode has no surface of its own. The filter in the chrome band —
already permanent, already the keyboard's first stop via `/` — takes a second
job, and the browse column below it changes what it is listing. Nothing appears.
Nothing is covered. Nothing has to be dismissed.

## 2 · The two jobs of one input

Typing `>` as the first character switches the filter from narrowing to
commanding. One character is the whole signal — no space required, no mode
button, nothing to remember beyond the character itself.

While `>` is live:

| | Filter mode | Command mode |
| --- | --- | --- |
| The box | narrows the browse list | runs commands |
| Its accent | tool cyan | prompt violet |
| Its face | UI | mono |
| Placeholder | `filter…` | `command…` |
| The column | entities | commands |
| The segments | live, showing hit counts | receded, showing totals |

The accent change is deliberate and carries most of the weight: the browse
list's cyan, amber and violet belong to *kinds*, and a command has no kind, so
command mode borrows violet as its own. You can see the box has changed job
before reading a single row.

**The browse filter is not active while commanding.** `>dis` narrows commands,
not tools — the rows it would have receded are not on screen. Escape still has
to unwind the box before the subject, so the key model is told the input is busy
either way (`BrowseColumn`'s `filterActive` vs `queryActive`).

## 3 · The commands

Six actions, all of which already existed as buttons. **Command mode adds no
capability** — only a second route.

| Command | Available when | Notes |
| --- | --- | --- |
| Home | something is selected | home is only somewhere to go *from* somewhere |
| Copy link to this selection | something is selected | the address bar verbatim (see §5) |
| Show raw / Show rendered | something on screen is rendered markdown | one row, naming the direction it travels |
| Switch to light/dark mode | always | names the mode it moves *to* |
| Disconnect | always | "return to the connect screen" |

**`connect` is not a seventh row.** The roadmap listed connect and disconnect
separately; in the code they are one path — `App.disconnect()` closes the
connection and lands on the connect screen, which *is* where a server is chosen.
Two rows for one outcome would be furniture that lies about having two. The
single row says where it goes, and `>connect` finds it by keyword.

**Raw and rendered are one row, not two.** A list offering both at once would be
asking the reader to work out which is currently true. The row names the
direction it would travel, exactly as the theme row does.

## 4 · Matching

Ranked, not merely filtered, because the ranks are what make a two-character
query land predictably:

1. the label starts with the query
2. a later word in the label starts with it
3. the label contains it anywhere
4. only a keyword matches

So `co` reaches **Copy link to this selection** before **Disconnect**, which
merely contains `co` in the middle of a word nobody was typing. A keyword-only
hit sorts last: it found a command the words on screen never named, so it has
the weakest claim to being what was meant.

The command list always has a highlight, unlike the browse list. You reached it
by typing, so ⏎ should run the best match without a preparatory ↓. The highlight
is derived rather than stored, so narrowing moves it to the new best match
instead of stranding it on a row that has gone.

## 5 · What happens after a command runs

Running a command clears the filter, and the column goes back to browsing. The
effects are self-evident: the theme changes, the subject changes, the connection
drops.

**Copy link is the exception**, because a clipboard write looks like nothing at
all. Its row holds for 1.5 seconds showing `Link copied` in the slot its hint
occupied — no height change, no new element, no toast. Then the column returns.

The link itself is `window.location.href`, unmodified. S1 already keeps the URL
in step with the selection, so there is nothing to rebuild and no way for the
copied link to disagree with the page it was copied from.

## 6 · Shortcut legibility

Before this session `/` was advertised only as `aria-keyshortcuts` on the filter
— documented to screen readers and to nobody else.

**The keycap** is the new visual pattern, approved 2026-08-30. Raycast treats
keycaps as the one place depth decoration is allowed: gradient fill, a bottom
edge, a press transform. This app is flat and hairline everywhere, so the cap
takes the same 1px border every chip, badge and row already wears, and earns its
identity from **shape** instead: a 4px corner where every other small container
in the app is a 999px pill, and one fixed 18px box so `⏎`, `/` and `esc` line up
optically rather than each being as wide as its own glyph.

`--radius-xs: 4px` was added for it. At `--radius-s`, an 18px square renders as a
circle — which is the exact pill shape the cap must not be mistaken for. It is
on the dune parity allowlist beside the other radii.

Two places carry caps, and both are furniture that was already on screen:

- **Inside the filter's right edge.** At rest it shows `/`, the key that reaches
  the box from anywhere. With the caret inside — where `/` would only type a
  slash — it shows `>`, the character that changes the box's job. The second
  job announces itself exactly when you are in a position to use it.
- **Under the command list.** `↑↓ move · ⏎ run · esc back to filter`, taught
  while those keys are live and gone when they are not.

## 7 · Where it lives

`src/ui/deck/commands.ts` is pure and React-free, like `keynav.ts`: the command
list, which of them apply, how a query narrows them, and what each one calls.
All four are tested as functions, with dispatch taking a handlers record so it
can be driven by spies.

`keynav.ts` was widened by exactly one thing: `moveActive` now takes a
`MovableRow` (`{ key, receded }`) rather than a `NavRow`, so command rows move
through the same function. `keyAction` is untouched — the column's key model does
not change when its contents do.

`BrowseColumn` binds it. `DeckView` assembles the command list, because it is the
one place that can see the selection, the theme and the result at once.

**Two pieces of state had to be lifted**, and both were single-owner problems
rather than plumbing for its own sake:

- `ModeContext` — the mode was local to `ModeToggle`, which was correct while the
  toggle was the only way to change it. A command is a second route, and two
  owners would desync: the command would stamp the root attribute while the
  toggle went on drawing the glyph of the mode it thought was current.
- `rawView` — "Show raw" was local to each `TextBlock`. A command acts on the
  whole result, but the per-block button has to keep meaning *this block*. The
  shared value carries an **epoch**: a clicked block remembers the epoch it was
  clicked in, and its override expires the moment a command speaks for
  everything. Click one block, only that block flips; run the command, they all
  agree again. The provider also counts mounted markdown blocks, which is how
  the command knows whether it is worth offering at all.

## 8 · Verified

Tier 1: 13 tests over matching, ranking, availability and dispatch. Tier 2: 8
tests over the column swap, narrowing, ↑↓⏎, the receipt, Escape's exit, and the
absence of commands that have nothing to act on. `npm run build` clean; 308 tests
pass.

Headless, light and dark, against the built app: command mode renders, the
segments recede without the column's silhouette moving, the caps read as keys
rather than as chips, and there are no console errors. Two rounds — the first
found the command labels truncating to `Copy li…` and `Disconn…` beside their
hints (now stacked), and the keycap rendering as a circle at `--radius-s` (now
`--radius-xs`).

## 9 · Not done here

`>` has no shortcut of its own — you reach it through `/`, then type it. A
dedicated chord would be a fourth binding to teach for a saving of one keystroke.
