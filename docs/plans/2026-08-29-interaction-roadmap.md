# Interaction roadmap — four sessions

**Date**: 2026-08-29 · **Status**: planned, not started · **Source**: the five
UI/interactivity suggestions from the 2026-08-29 research pass, all accepted.

Each session below is sized to finish at **~35% of a context window** and must
not exceed 40%. They are ordered by dependency, but only S1 → S2 is a hard
sequence; S3 and S4 can be taken in any order once S1 lands.

Every session is written to be started **cold**, after a context clear: goal,
decisions already settled, decisions still open, files, verification, done-when,
and what to drop first if it runs long.

## Budget model

Calibrated against the 2026-08-29 reading pass, which was scoped at 30% and
landed near it. That session's shape — orientation ~10%, implementation ~10%,
headless verification ~8%, docs ~5% — is the yardstick used below.

The expensive part is never the edits. It is **screenshot rounds** (~2–3% each
once iteration loops are counted) and **live-server test runs**. A session that
needs three visual rounds has ~10% less room for everything else, which is why
S2 and S4 carry less scope than S1 and S3.

---

## S1 · Addressable selection + keyboard navigation

Suggestions **#2** (selection in the URL) and the navigation half of **#1**.

**Goal.** You can link someone to a specific tool, Back/Forward walk your
selection history, reload puts you back where you were, and the whole browse
column is reachable without a mouse.

**Why these two together.** They are the same question asked twice — "how do I
get to a thing" — and they touch the same three files. Keyboard selection that
does not update the URL would have to be revisited the moment #2 lands.

### Settled

- URL shape: `?server=…&tool=NAME`, `&resource=URI`, `&prompt=NAME`. One
  parameter for the kind, so the selection is self-describing and a stray
  combination is ignorable.
- `pushState` for a user-initiated selection, `replaceState` for a
  programmatic one (auto-connect, redirect after connect), plus a `popstate`
  listener. Today `App.tsx:24` uses `replaceState` for everything.
- Keys: `/` focuses the filter from anywhere, ↑↓ move through the filtered list,
  ⏎ selects (and runs, for zero-argument tools), Esc clears the filter if it has
  text and otherwise returns home — Esc already returns home
  (`DeckView.tsx:31`) and that must keep working.
- Selection still does not move focus, per the tool-first workspace spec.

### Open — decide in-session

- Whether ↑↓ from the filter box moves a *highlight* separate from the current
  selection (VS Code-style: highlight moves, Enter commits) or selects directly
  as it moves. Direct selection is fewer concepts and this workspace re-renders
  cheaply; highlight-then-commit is what a list of 155 Hugging Face resources
  probably wants. Resolve against the Hugging Face case, not the demo server.
- What a resource URI does to URL length — percent-encoded URIs are long, and
  `hf://` resources will make an ugly link. Consider an index instead of a URI
  if it gets silly.

### Files

`src/App.tsx` (URL read/write), `src/ui/deck/DeckView.tsx` (key handling),
`src/ui/ChromeBar.tsx` (filter focus, `/` hint), `src/ui/deck/BrowseColumn.tsx`
(highlight, scroll-into-view), `src/ui/recents.ts` untouched.

### Verification

- Tier 1: URL round-trip is pure logic — parse a URL to a selection and back.
  Test the ignorable-garbage cases (`?tool=` naming a tool that does not exist,
  both `tool=` and `resource=` present).
- Live: deep-link straight into a deepwiki tool; Back returns to Home; reload
  holds; a 155-resource Hugging Face list is navigable by keyboard end to end.
- One screenshot round is enough — this is behaviour, not appearance.

**Done when** a link to a tool opens that tool for someone who has never used
the app, and the browse column can be driven start to finish with no mouse.

**Drop first if long:** keyboard navigation of *resources* (the tree adds
expand/collapse to the key model). Ship tools and prompts, note the gap.

**Budget:** ~30%. Logic-heavy, one screenshot round.

---

## S2 · Command mode and shortcut legibility

The rest of suggestion **#1**.

**Goal.** Typing `>` in the filter turns it into a command line; the app's
shortcuts are visible without being told about them.

**Why separate from S1.** This half is visual — command mode needs a rendered
look, and keycap glyphs are a new visual pattern that needs your sign-off per
CLAUDE.md. Bundling it with S1 would put a design conversation in the middle of
a plumbing session.

### Settled

- No overlay, no ⌘K modal. The command surface is the filter input that is
  already in the chrome band. This is a deliberate divergence from the industry
  pattern, on the record in the research pass: arriving surfaces are rejected,
  permanent furniture is not.
- Commands for v1: connect, disconnect, copy link to this selection, toggle
  theme, show raw / show rendered, home. All already exist as UI actions —
  command mode adds no new capability, only a second route.

### Open — decide in-session

- **New visual pattern, needs approval before building:** keycap glyphs
  (`⏎`, `/`, `Esc`) rendered next to the actions they trigger. Raycast treats
  these as the one place depth decoration is allowed; this app has a strictly
  flat, hairline visual system, so a gradient-filled key would be a genuine
  departure. Propose a flat variant first.
- Where the command list renders. It cannot be a popover over the column
  (rejected pattern). Candidate: the column itself becomes the command list
  while `>` is active — the furniture changes contents, nothing arrives.
- Whether `>` is discoverable at all without a hint, and where that hint lives.

### Files

`src/ui/ChromeBar.tsx`, `src/ui/deck/BrowseColumn.tsx`, a new
`src/ui/deck/commands.ts` (pure: the command list, filtering, and what each one
dispatches — keep it testable and free of React).

### Verification

- Tier 1: command matching and dispatch are pure functions.
- Two or three screenshot rounds — this is the appearance-heavy session.

**Done when** every action in the app is reachable from the keyboard and the
three most important shortcuts are visible on screen without documentation.

**Drop first if long:** the keycap glyphs. Command mode without them still
works; shortcuts without command mode do not.

**Budget:** ~30%. Small code, several visual rounds, one design approval gate.

---

## S3 · The run record: history and honest progress

Suggestions **#3** (run history) and **#4** (progress).

**Goal.** A tool run three times keeps three answers, each labelled by its
arguments and restorable into the form; and while a run is in flight the UI says
something true about it.

**Why these two together.** Both live in `RunContext`, which today keys results
by tool name and holds exactly one per tool. Both rewrite the same state shape,
and doing them separately means designing that shape twice.

### Settled

- History is per tool, in memory, capped (10 runs feels right; decide against a
  real session). Not persisted to localStorage in v1 — results can be megabytes
  and the token/PII surface of persisting server responses needs its own
  thought.
- A past run restores **both** its result and the arguments that produced it,
  so "edit and re-run" is one click. `argValues.ts` already maps schema to
  values and back, so the form can be refilled from a stored args object.
- The history list is furniture inside the existing result region — not a drawer,
  not a panel.

### Open — decide in-session

- **Spike first, before committing to the streaming half.** Does the installed
  `@modelcontextprotocol/sdk` surface progress notifications
  (`notifications/progress`) to a browser client, and does deepwiki or Hugging
  Face actually send them? Time-box it. If yes, show real progress. If no, fall
  back to elapsed-time plus a live character count as text arrives — which is
  honest and still fixes the "is it hung?" problem.
- How a run is labelled in the list when its arguments are long. A 200-character
  question needs truncating without becoming ambiguous.
- Whether a failed run joins the history (argument: yes — the failures are what
  you want to compare).

### Files

`src/ui/run/RunContext.tsx` (the state shape — the centre of this session),
`src/ui/deck/ToolView.tsx`, `src/ui/deck/PromptView.tsx` (prompts run too),
`src/ui/form/argValues.ts` (refill path), possibly `src/mcp/connect.ts` for
progress plumbing.

### Verification

- Tier 1: the reducer is pure — add a run, cap the list, restore one, key by
  args. This is the best-tested piece on the roadmap.
- Tier 2: RTL over `ToolView` — run twice with different args, both answers
  reachable.
- Live: `ask_question` on deepwiki three times; `read_wiki_contents` for the
  10–15 second progress case.

**Done when** you can run a tool twice, compare both answers, and re-run an
earlier one without retyping.

**Drop first if long:** the streaming half of #4. Elapsed time alone already
fixes the trust problem; ship it and leave a TODO for real progress.

**Budget:** ~35%. The largest session — a spike, a state-shape rewrite, and the
most tests. Do not add anything to it.

---

## S4 · The result outline

Suggestion **#5**.

**Goal.** A 50,000-character wiki page becomes navigable: a sticky outline in
the workspace's right margin, built from the headings the parser already emits.

**Why last.** It is the only one of the five that resolves purely from rendered
pixels, and it is the direct sequel to the reading pass — the margin it fills is
the space that pass deliberately created (workspace 1140, content 780).

### Settled

- Built from `parseBlocks`' existing heading levels — the reading pass gave
  headings two real tiers, so the outline has a structure to show.
- Lives in the right margin, permanently present when the result has enough
  headings and absent when it does not.
- Click to jump; the current section highlights while scrolling.

### Open — decide in-session

- The threshold: how many headings before an outline appears at all. Three is a
  guess; check it against `read_wiki_contents`, a short `ask_question` answer,
  and a Hugging Face resource.
- What happens below ~1180px, where the margin does not exist. Most likely: no
  outline, no substitute. Confirm rather than inventing a mobile affordance.
- Whether it also covers the home view's expanded `instructions` (probably not —
  that text has no headings).

### Files

`src/ui/markdown/parse.ts` (stable heading ids — slugged, deduped; hostile
input, so the slugger must be total), `src/ui/markdown/Markdown.tsx`,
a new `src/ui/deck/Outline.tsx` + module CSS, `src/ui/deck/Workspace.module.css`.

### Verification

- Tier 1: slug generation and collision handling against hostile headings
  (empty, emoji-only, 500 characters, duplicates).
- Three or four screenshot rounds, light and dark, deepwiki and Hugging Face,
  at 1180 / 1440 / 1920. This is the pixel-iteration session.

**Done when** the outline makes a long deepwiki result feel navigable and the
margin stops reading as empty.

**Drop first if long:** scroll-spy highlighting. A clickable outline with no
active-section tracking is still useful; the reverse is not.

**Budget:** ~30%. Small code, heavy visual iteration.

---

## Sequence and dependencies

```
S1 ──▶ S2        (command mode needs the key model S1 establishes)
S1 ──▶ S4        (outline links are selection-adjacent; not strictly blocking)
S3               (independent — take it any time after S1)
```

S1 first is not negotiable: #2 is the cheapest real win on the list and both S2
and S4 read better on top of it.

## Not in scope

- Persisting run history across reloads (S3 notes why).
- A ⌘K overlay in any form.
- Multi-server comparison (TODO-16) — unrelated and much larger.
- Mobile/narrow-viewport treatments beyond "the outline does not appear".

## Cost

All four sessions: **zero paid resources, no new dependencies**. If S2's keycap
glyphs end up wanting an icon set, that is a dependency decision to raise then —
the expectation is inline SVG or plain text.
