import { useState } from "react"
import { motion } from "motion/react"
import type { Tool } from "@modelcontextprotocol/sdk/types.js"
import ArgsForm from "../form/ArgsForm"
import { assembleArgs, canSubmit, fieldSpecs, type Values } from "../form/argValues"
import { useRuns, type RunState } from "../run/RunContext"
import { TextBlock, Truncated } from "./blocks"
import styles from "./Workspace.module.css"

/**
 * A tool as the workspace's subject (tool-first workspace spec §6). Zero-argument
 * tools have already run by the time they get here — selecting them in the column
 * is the run. Tools with arguments show their form and wait for Run.
 */
export interface ToolViewProps {
  tool: Tool
  values: Values
  onChange: (name: string, value: string) => void
  onRun: (args: Record<string, unknown>) => void
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

// Results land with a settle; errors land flat and honest — no success motion.
// The aria-live container persists across states so screen readers hear content
// change inside it rather than a region appearing.
function RunResult({ state }: { state: RunState }) {
  return (
    <div className={styles.resultArea} aria-live="polite">
      <p className={styles.microlabel}>RESULT</p>
      {state.status === "idle" && <p className={styles.quiet}>Run the tool to see its result here.</p>}
      {state.status === "running" && <p className={styles.quiet}>Running…</p>}
      {state.status === "done" &&
        (state.display.ok ? (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            {state.display.blocks.map((b, i) => (
              <div key={i} className={styles.block}>
                {b.label && <p className={styles.microlabel}>{b.label.toUpperCase()}</p>}
                <TextBlock text={b.text} />
              </div>
            ))}
            {state.display.truncated && <Truncated />}
          </motion.div>
        ) : (
          <div role="alert" className={styles.errorBlock}>
            {state.display.blocks.map((b, i) => (
              <pre key={i} className={styles.code}>
                {b.text}
              </pre>
            ))}
          </div>
        ))}
    </div>
  )
}

export default function ToolView({ tool, values, onChange, onRun }: ToolViewProps) {
  const { runs } = useRuns()
  const specs = fieldSpecs(tool.inputSchema)
  const assembly = assembleArgs(specs, values)
  const ready = canSubmit(assembly)
  const state = runs[tool.name] ?? { status: "idle" }
  const running = state.status === "running"

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

      <RunResult state={state} />
      <RawJson value={tool} />
    </>
  )
}
