import { useState } from "react"
import { motion } from "motion/react"
import type { Tool } from "@modelcontextprotocol/sdk/types.js"
import ArgsForm from "../form/ArgsForm"
import { assembleArgs, canSubmit, fieldSpecs, type Values } from "../form/argValues"
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
import styles from "./Workspace.module.css"

/**
 * A tool as the workspace's subject (tool-first workspace spec §6). Zero-argument
 * tools have already run by the time they get here — selecting them in the column
 * is the run. Tools with arguments show their form and wait for Run.
 *
 * Since 2026-08-29 a tool keeps a capped history of runs (interaction roadmap S3):
 * the result region shows one run and lists the rest beneath it, and picking one
 * restores both its answer and the arguments that produced it.
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
          <button type="button" className={styles.ghostButton} onClick={() => void navigator.clipboard?.writeText(json)}>
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

export default function ToolView({ tool, values, onChange, onRun, onRestore }: ToolViewProps) {
  const { runs, view } = useRuns()
  const specs = fieldSpecs(tool.inputSchema)
  const assembly = assembleArgs(specs, values)
  const ready = canSubmit(assembly)
  const records = recordsOf(runs, tool.name)
  const viewed = viewedRecord(runs, tool.name)
  const running = isRunning(runs, tool.name)

  const reason = !ready
    ? assembly.missing.length > 0
      ? `fill ${assembly.missing.join(", ")} to run`
      : "fix the field errors above to run"
    : specs.length === 0
      ? "takes no arguments"
      : undefined

  return (
    <>
      <h2 className={styles.title}>{tool.name}</h2>
      {tool.description && <p className={styles.description}>{tool.description}</p>}

      <div className={styles.form}>
        {specs.length > 0 && (
          <>
            <p className={styles.microlabel}>ARGUMENTS</p>
            <ArgsForm
              specs={specs}
              values={values}
              onChange={onChange}
              errors={assembly.errors}
              idPrefix={`tool-${tool.name}`}
            />
          </>
        )}

        <div className={styles.runRow}>
          <button
            type="button"
            className={styles.run}
            disabled={!ready || running}
            onClick={() => onRun(assembly.args)}
          >
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
          {reason && <span className={styles.quiet}>{reason}</span>}
        </div>
      </div>

      {/* The aria-live container persists across states so screen readers hear
          content change inside it rather than a region appearing. */}
      <div className={styles.resultArea} aria-live="polite">
        <p className={styles.microlabel}>RESULT</p>
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
      </div>
      <RawJson value={tool} />
    </>
  )
}
