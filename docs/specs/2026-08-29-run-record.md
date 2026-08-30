# The run record: history and honest progress

**Date**: 2026-08-29 · **Status**: built · **Session S3** of
[`docs/plans/2026-08-29-interaction-roadmap.md`](../plans/2026-08-29-interaction-roadmap.md)
· Closes **TODO-27** and **TODO-28**.

Two problems in one state shape. `RunContext` keyed results by tool name and held
exactly one, so running a tool again discarded the previous answer; and a call in
flight showed a static "Running…" that could not distinguish working from hung.
Both rewrite the same state, so both were done at once.

## 1 · The spike, first

The plan required settling the streaming question before committing to it.

**Does the installed SDK surface progress to a browser client?** Yes —
`client.callTool(params, resultSchema, { onprogress, resetTimeoutOnProgress })`
is in `@modelcontextprotocol/sdk` 1.30.

**Do real servers send any?** No. Measured 2026-08-29 against the live servers:

| Call | Duration | `notifications/progress` received |
| --- | --- | --- |
| deepwiki `read_wiki_contents` | 0.8 s, ~1 MB | 0 |
| deepwiki `ask_question` | 12.2 s | 0 |
| Hugging Face `hub_repo_search` | 0.3 s | 0 |

So the fallback is what ships: **elapsed time**. `onprogress` is wired anyway —
it costs one option, it is honest when a server does report, and
`resetTimeoutOnProgress` is the entire point of a server bothering to send it. A
server's own progress is shown beside the counter when it arrives.

The plan's other fallback idea — "a live character count as text arrives" — is
not available: `tools/call` returns one JSON-RPC result, not a stream. Nothing
arrives until everything does. Claiming a character count would have been the
dishonest option, which is the opposite of what TODO-28 was about.

## 2 · The state shape

`src/ui/run/runHistory.ts`, pure — every transition is `Runs → Runs`, so the
centre of this session is tested without React.

```
Runs      = Record<toolName, ToolRuns>
ToolRuns  = { records: RunRecord[]   // newest first, capped at 10
              viewingId: number|null } // null means "the newest"
RunRecord = { id, args, startedAt, endedAt?, display?, progress? }
```

- **In memory only.** Persisting server responses has a token/PII surface that
  needs its own thought, and a single deepwiki result is ~1 MB.
- **Ten runs.** Enough to compare a few attempts, short enough to stay scannable.
- **A new run is what you are looking at**, even if you were browsing an old one.
- **Failed runs join the history** — the failures are exactly what you want to
  compare against the successes, so they get a row and a `failed` marker.
- Settling or viewing a record the cap has already dropped is a no-op rather
  than an error or a blank region.

## 3 · Restoring a run

Picking a row restores **both** its answer and the arguments that produced it, so
"edit and re-run" is one click. `valuesFromArgs` in `argValues.ts` is the inverse
of `assembleArgs`, and the round-trip is a test: re-running a restored form sends
the identical call. An argument the run omitted comes back **blank**, not
`false`/`0` — an optional the run never sent must stay unsent.

Restoring replaces the whole value set rather than merging with what is currently
typed, which would produce a form matching neither run.

## 4 · Labelling

Each argument value gets an **equal share** of a 96-character budget rather than
first-come truncation. Found live: deepwiki's `ask_question` takes a long
`repoName` and a long `question`, and a single global truncation spent the whole
budget on the repo, leaving every run labelled `question: How does…` — precisely
the ambiguity a label exists to prevent. A row also carries its start time and
its duration, and the full arguments live in its `title`.

## 5 · Appearance

The history list is **furniture inside the existing result region** — under the
answer it belongs to, not a drawer and not a panel. It appears only once there is
more than one run: a list of one is noise. Rows borrow the browse column's row
language (hairline, identifier face, accent earned by `aria-current`), so the
app's two lists read as one component family.

The in-flight counter ticks at **100 ms, not 1 s**: a counter that only moves
once a second looks frozen for its first second, which is the exact impression
this exists to dispel. Sub-10 s keeps one decimal for the same reason.

## 6 · Scope

- **Tools only.** Resource and prompt reads are cached by subject, so a repeat is
  instant and there is nothing to keep a history of. They do get the ticking
  elapsed time, since a slow read has the same "is it hung?" problem.
- Not persisted across reloads (§2).

## 7 · Verified

Tier 1 over the reducer (cap, ordering, viewing, per-tool isolation, dropped
ids, labelling, elapsed formatting, progress formatting) and over the
args round-trip. Tier 2 over `ToolView`: run twice with different arguments and
both answers stay reachable, restoring refills the form, a failed run joins the
list, and a fake-timed in-flight run reports 0.0 s then 2.5 s. Live against
deepwiki: two 14-second `ask_question` runs, both labelled by their full
questions, restoring one brought back its answer and its question field.
