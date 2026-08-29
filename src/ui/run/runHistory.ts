import type { RunDisplay } from "./runResult"

/**
 * The run record (interaction roadmap S3 / TODO-27, TODO-28).
 *
 * Before this, run state was one `RunState` per tool name, so running a tool
 * again with different arguments discarded the previous answer — the one thing
 * every API client treats as core. A tool now keeps a capped stack of runs, each
 * labelled by the arguments that produced it and restorable into the form.
 *
 * Pure on purpose: every transition here is a function from `Runs` to `Runs`, so
 * the state shape — the centre of this session — is tested without React.
 *
 * In memory only. Persisting server responses has a token/PII surface that needs
 * its own thought, and results can be megabytes (deepwiki's `read_wiki_contents`
 * returns ~1 MB), so localStorage is out of the question in v1.
 */

/** Ten is enough to compare a few attempts and short enough to stay scannable. */
export const MAX_HISTORY = 10

/** A `notifications/progress` payload, when a server bothers to send one. */
export interface RunProgress {
  progress: number
  total?: number
  message?: string
}

export interface RunRecord {
  /** Monotonic within the session — a stable React key and the id `view` takes. */
  id: number
  args: Record<string, unknown>
  startedAt: number
  /** Absent while the call is in flight. */
  endedAt?: number
  /** Absent while the call is in flight. Failures are recorded too — the failures
   *  are exactly what you want to compare against the successes. */
  display?: RunDisplay
  progress?: RunProgress
}

export interface ToolRuns {
  /** Newest first. */
  records: RunRecord[]
  /** Which record the workspace is showing; null means "the newest". */
  viewingId: number | null
}

export type Runs = Record<string, ToolRuns>

const emptyRuns: ToolRuns = { records: [], viewingId: null }

const update = (runs: Runs, tool: string, fn: (t: ToolRuns) => ToolRuns): Runs => ({
  ...runs,
  [tool]: fn(runs[tool] ?? emptyRuns),
})

const patch = (t: ToolRuns, id: number, fn: (r: RunRecord) => RunRecord): ToolRuns => ({
  ...t,
  records: t.records.map((r) => (r.id === id ? fn(r) : r)),
})

/** A new run becomes the newest record and the one on screen. */
export function startRun(
  runs: Runs,
  tool: string,
  id: number,
  args: Record<string, unknown>,
  at: number,
): Runs {
  return update(runs, tool, (t) => ({
    records: [{ id, args, startedAt: at }, ...t.records].slice(0, MAX_HISTORY),
    viewingId: id,
  }))
}

export function progressRun(runs: Runs, tool: string, id: number, progress: RunProgress): Runs {
  return update(runs, tool, (t) => patch(t, id, (r) => ({ ...r, progress })))
}

export function settleRun(runs: Runs, tool: string, id: number, display: RunDisplay, at: number): Runs {
  return update(runs, tool, (t) => patch(t, id, (r) => ({ ...r, display, endedAt: at })))
}

/** Show a past run. An id the cap has already dropped is ignored. */
export function viewRun(runs: Runs, tool: string, id: number): Runs {
  return update(runs, tool, (t) => (t.records.some((r) => r.id === id) ? { ...t, viewingId: id } : t))
}

export function recordsOf(runs: Runs, tool: string): RunRecord[] {
  return runs[tool]?.records ?? []
}

export function viewedRecord(runs: Runs, tool: string): RunRecord | null {
  const t = runs[tool]
  if (t === undefined || t.records.length === 0) return null
  return t.records.find((r) => r.id === t.viewingId) ?? t.records[0]
}

/** In flight means the newest record has not settled. Only one run per tool at a time. */
export function isRunning(runs: Runs, tool: string): boolean {
  const newest = runs[tool]?.records[0]
  return newest !== undefined && newest.endedAt === undefined
}

/* ── labelling ── */

/**
 * The budget a label spends on argument *values*, shared equally between them.
 * Shared, not first-come: deepwiki's `ask_question` takes a long `repoName` and
 * a long `question`, and a single global truncation spent the whole budget on
 * the repo — leaving every run labelled `question: How does…`, which is exactly
 * the ambiguity a label exists to prevent. The row's own CSS ellipsis is the
 * final backstop, and the full arguments stay in its `title`.
 */
export const LABEL_VALUE_BUDGET = 96
/** A floor, so a tool with many arguments still shows something of each. */
export const MIN_VALUE_CHARS = 14
/** A hard stop, so a 30-argument call cannot put a novel in the DOM. */
export const MAX_LABEL_CHARS = 240

function scalar(value: unknown): string {
  if (typeof value === "string") return value
  if (value === undefined) return "undefined"
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    // Untrusted arguments can hold a cyclic object if a JSON field produced one.
    return String(value)
  }
}

const clip = (text: string, limit: number) =>
  text.length <= limit ? text : text.slice(0, limit - 1).trimEnd() + "…"

/**
 * What a run is called in the list. Two long arguments each keep half the
 * budget, so the one that actually differs between runs stays visible. Even so
 * a label can truncate, which is why the row also carries its start time and the
 * full arguments in a `title` — better an honest ellipsis than a label that
 * pretends to be complete.
 */
export function runLabel(args: Record<string, unknown>): string {
  const keys = Object.keys(args)
  if (keys.length === 0) return "no arguments"
  const share = Math.max(MIN_VALUE_CHARS, Math.floor(LABEL_VALUE_BUDGET / keys.length))
  const joined = keys.map((k) => `${k}: ${clip(scalar(args[k]), share)}`).join(" · ")
  return clip(joined, MAX_LABEL_CHARS)
}

/**
 * How long it has been. Sub-10s keeps a decimal so the number visibly moves —
 * a counter that only ticks once a second reads as frozen for the first second,
 * which is the exact impression this is here to dispel.
 */
export function elapsedLabel(ms: number): string {
  const s = Math.max(0, ms) / 1000
  if (s < 10) return `${s.toFixed(1)}s`
  if (s < 60) return `${Math.round(s)}s`
  const m = Math.floor(s / 60)
  return `${m}m ${String(Math.round(s - m * 60)).padStart(2, "0")}s`
}

/**
 * A server's own progress, when it sends any. `total` is optional in the spec,
 * so a bare counter is a legitimate report and must not be rendered as a
 * percentage of nothing.
 */
export function progressLabel(p: RunProgress | undefined): string | undefined {
  if (p === undefined) return undefined
  const message = typeof p.message === "string" && p.message.trim() !== "" ? p.message.trim() : undefined
  const count =
    typeof p.total === "number" && p.total > 0
      ? `${Math.round((p.progress / p.total) * 100)}%`
      : Number.isFinite(p.progress)
        ? `step ${p.progress}`
        : undefined
  return [count, message].filter((s) => s !== undefined).join(" — ") || undefined
}
