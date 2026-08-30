import { useState } from "react"
import { motion } from "motion/react"
import type { Tool } from "@modelcontextprotocol/sdk/types.js"
import ArgsForm from "../form/ArgsForm"
import { assembleArgs, canSubmit, fieldSpecs, type FieldSpec, type Values } from "../form/argValues"
import { useRuns } from "../run/RunContext"
import {
  elapsedLabel,
  isRunning,
  progressLabel,
  recordsOf,
  runLabel,
  viewedRecord,
  type RunRecord,
} from "../run/runHistory"
import { Elapsed, TextBlock, Truncated } from "./blocks"
import ClampedText from "./ClampedText"
import Glyph from "./Glyph"
import styles from "./Workspace.module.css"

/**
 * A tool as the workspace's subject (tool-first workspace spec §6). Zero-argument
 * tools have already run by the time they get here — selecting them in the column
 * is the run. Tools with arguments show their form and wait for Run.
 *
 * Since 2026-08-29 a tool keeps a capped history of runs (interaction roadmap S3):
 * the result region shows one run and lists the rest beneath it, and picking one
 * restores both its answer and the arguments that produced it.
 *
 * Laid out in three zones since 2026-08-30 (spec 2026-08-30-tool-legibility.md).
 * It used to be one flat stack of seven elements at one rhythm — identity,
 * description, label, fields, button, label, result — so nothing said which of
 * them belonged together and the whole page had to be read to find any of it.
 * Now: what the tool IS, what it WANTS from you, and what it GAVE BACK, with the
 * Run button at the top of the middle zone and the answer visibly cordoned off
 * from the definition.
 */
export interface ToolViewProps {
  tool: Tool
  values: Values
  onChange: (name: string, value: string) => void
  onRun: (args: Record<string, unknown>) => void
  /** Refill the form from a past run's arguments. */
  onRestore: (args: Record<string, unknown>) => void
}

function RawJson({ value }: { value: unknown }) {
  // A closed <details> still puts its children in the DOM (CSS only hides them),
  // so render the dump once opened — keeps text queries honest.
  const [open, setOpen] = useState(false)
  const json = JSON.stringify(value, null, 2)
  return (
    <details className={styles.raw} open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>Raw JSON</summary>
      {open && (
        <>
          <button
            type="button"
            className={styles.ghostButton}
            onClick={() => void navigator.clipboard?.writeText(json)}
          >
            Copy
          </button>
          <pre className={styles.code}>{json}</pre>
        </>
      )}
    </details>
  )
}

function Running({ record }: { record: RunRecord }) {
  const progress = progressLabel(record.progress)
  return (
    <p className={styles.quiet}>
      Running… <Elapsed since={record.startedAt} />
      {progress !== undefined && ` · ${progress}`}
    </p>
  )
}

// Results land with a settle; errors land flat and honest — no success motion.
function Answer({ record }: { record: RunRecord }) {
  const display = record.display
  if (display === undefined) return <Running record={record} />
  return display.ok ? (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      {display.blocks.map((b, i) => (
        <div key={i} className={styles.block}>
          {b.label && <p className={styles.microlabel}>{b.label.toUpperCase()}</p>}
          <TextBlock text={b.text} idPrefix={`b${i}`} />
        </div>
      ))}
      {display.truncated && <Truncated />}
    </motion.div>
  ) : (
    <div role="alert" className={styles.errorBlock}>
      {display.blocks.map((b, i) => (
        <pre key={i} className={styles.code}>
          {b.text}
        </pre>
      ))}
    </div>
  )
}

const clockTime = (at: number) =>
  new Date(at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })

/**
 * The history list: furniture inside the result region, not a drawer and not a
 * panel. It appears only once there is more than one run to choose between —
 * a single run is already on screen and a list of one is noise.
 */
function History({
  records,
  viewingId,
  onPick,
}: {
  records: RunRecord[]
  viewingId: number
  onPick: (record: RunRecord) => void
}) {
  return (
    <div className={styles.history}>
      <p className={styles.microlabel}>RUNS</p>
      <ul className={styles.historyList}>
        {records.map((record) => {
          const failed = record.display !== undefined && !record.display.ok
          return (
            <li key={record.id}>
              <button
                type="button"
                className={styles.historyRow}
                aria-current={record.id === viewingId ? "true" : undefined}
                // The label truncates, so the full arguments stay reachable.
                title={JSON.stringify(record.args, null, 2)}
                onClick={() => onPick(record)}
              >
                <span className={styles.historyTime}>{clockTime(record.startedAt)}</span>
                <span className={styles.historyLabel}>{runLabel(record.args)}</span>
                <span className={styles.historyStatus} data-failed={failed || undefined}>
                  {record.endedAt === undefined
                    ? "running"
                    : failed
                      ? "failed"
                      : elapsedLabel(record.endedAt - record.startedAt)}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * The optional arguments, behind a disclosure.
 *
 * Most MCP tools are one required argument and several optional ones, and
 * showing all of them at once is what made "Arguments" a wall to read rather
 * than a thing to fill in. It opens by itself when any optional field already
 * carries a value — a restored run, or a schema default — or when one of them
 * has an error, because a validation message nobody can see is worse than no
 * disclosure at all.
 */
function OptionalArgs({
  specs,
  values,
  onChange,
  errors,
  idPrefix,
}: {
  specs: FieldSpec[]
  values: Values
  onChange: (name: string, value: string) => void
  errors: Record<string, string>
  idPrefix: string
}) {
  const forced = specs.some((s) => (values[s.name] ?? "") !== "" || errors[s.name] !== undefined)
  const [open, setOpen] = useState(false)
  const shown = open || forced
  return (
    <div className={styles.optional}>
      <button type="button" className={styles.optionalToggle} aria-expanded={shown} onClick={() => setOpen((o) => !o)}>
        <span className={styles.chevron} data-open={shown || undefined} aria-hidden="true">
          ▸
        </span>
        {specs.length} optional {specs.length === 1 ? "argument" : "arguments"}
      </button>
      {shown && (
        <div className={styles.optionalFields}>
          <ArgsForm specs={specs} values={values} onChange={onChange} errors={errors} idPrefix={idPrefix} />
        </div>
      )}
    </div>
  )
}

export default function ToolView({ tool, values, onChange, onRun, onRestore }: ToolViewProps) {
  const { runs, view } = useRuns()
  const specs = fieldSpecs(tool.inputSchema)
  const assembly = assembleArgs(specs, values)
  const ready = canSubmit(assembly)
  const records = recordsOf(runs, tool.name)
  const viewed = viewedRecord(runs, tool.name)
  const running = isRunning(runs, tool.name)

  const required = specs.filter((s) => s.required)
  const optional = specs.filter((s) => !s.required)
  // The disclosure exists to demote the secondary fields BENEATH the primary
  // ones. With no required argument there is no primary, so there is nothing to
  // demote and folding the whole form away would be strictly worse than the wall
  // it was meant to fix — every tool on the demo server is zero-required, and
  // plenty of real ones are too.
  const fold = required.length > 0 && optional.length > 0
  // "INPUT REQUIRED" is a lie over a form where nothing is required, and a tool
  // whose arguments are all optional is common enough to be worth telling the
  // truth about.
  const inputLabel = required.length > 0 ? "INPUT REQUIRED" : "INPUT"

  const reason = !ready
    ? assembly.missing.length > 0
      ? `fill ${assembly.missing.join(", ")} to run`
      : "fix the field errors below to run"
    : specs.length === 0
      ? "takes no arguments"
      : undefined

  const runButton = (
    <button type="button" className={styles.run} disabled={!ready || running} onClick={() => onRun(assembly.args)}>
      {running ? (
        "Running…"
      ) : specs.length === 0 ? (
        "Run again"
      ) : (
        <>
          Run <span className={styles.runName}>{tool.name}</span>
        </>
      )}
    </button>
  )

  return (
    <>
      {/* Zone 1 — what this tool is. An identity strip rather than a bare
          heading: the same glyph the column draws, the name, and the two facts
          worth knowing before reading a word of the description. */}
      <div className={styles.subjectHead}>
        <Glyph kind="tool" />
        <h2 className={styles.title}>{tool.name}</h2>
        {tool.annotations?.readOnlyHint === true && <span className={styles.headBadge}>read only</span>}
        <span className={styles.headBadge}>
          {specs.length === 0 ? "no arguments" : `${specs.length} ${specs.length === 1 ? "argument" : "arguments"}`}
        </span>
      </div>
      {tool.description && <ClampedText text={tool.description} lines={3} className={styles.description} />}

      {/* Zone 2 — what it wants from you. The Run button sits on the label's
          line, at the top of the form rather than under it: it is the first
          thing you look for, and putting it here keeps it beside the reason it
          is disabled. */}
      <div className={styles.form}>
        <div className={styles.inputHead}>
          <p className={styles.microlabel}>{specs.length === 0 ? "INPUT" : inputLabel}</p>
          <div className={styles.runRow}>
            {reason && <span className={styles.quiet}>{reason}</span>}
            {runButton}
          </div>
        </div>

        {(fold ? required : specs).length > 0 && (
          <ArgsForm
            specs={fold ? required : specs}
            values={values}
            onChange={onChange}
            errors={assembly.errors}
            idPrefix={`tool-${tool.name}`}
          />
        )}
        {fold && (
          <OptionalArgs
            specs={optional}
            values={values}
            onChange={onChange}
            errors={assembly.errors}
            idPrefix={`tool-${tool.name}`}
          />
        )}
      </div>

      {/* Zone 3 — what it gave back. Contained rather than merely spaced, so it
          reads as the server's answer and not as more of the tool's definition.
          The aria-live container persists across states so screen readers hear
          content change inside it rather than a region appearing. */}
      <section className={styles.resultArea} aria-live="polite" aria-label="Result">
        <header className={styles.resultHead}>
          <p className={styles.microlabel}>RESULT</p>
          {viewed !== null && (
            <span className={styles.resultMeta}>
              {clockTime(viewed.startedAt)}
              {viewed.endedAt !== undefined && ` · ${elapsedLabel(viewed.endedAt - viewed.startedAt)}`}
            </span>
          )}
        </header>
        {viewed === null ? (
          <p className={styles.quiet}>Run the tool to see its result here.</p>
        ) : (
          <Answer record={viewed} />
        )}
        {records.length > 1 && viewed !== null && (
          <History
            records={records}
            viewingId={viewed.id}
            onPick={(record) => {
              view(tool.name, record.id)
              onRestore(record.args)
            }}
          />
        )}
      </section>
      <RawJson value={tool} />
    </>
  )
}
