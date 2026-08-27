import { useState } from "react"
import { motion } from "motion/react"
import type { Connection } from "../mcp/types"
import type { EntitySelection } from "./stage"
import { classifyTool } from "./deck/deckModel"
import { useRuns, type RunState } from "./run/RunContext"
import { MAX_RESULT_CHARS } from "./run/runResult"
import { friendlyType, schemaRows } from "./schema"
import styles from "./DetailPanel.module.css"

export interface DetailPanelProps {
  connection: Connection
  selected: EntitySelection | null
  onClose: () => void
}

function RawJson({ value }: { value: unknown }) {
  // Closed <details> still puts its children in the DOM (only CSS hides them), so
  // an always-rendered <pre> dump collides in text queries with fields also shown
  // above (e.g. description). Render the dump only once the disclosure is opened.
  const [open, setOpen] = useState(false)
  const json = JSON.stringify(value, null, 2)
  return (
    <details className={styles.raw} open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>Raw JSON</summary>
      {open && (
        <>
          <button
            type="button"
            className={styles.copy}
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

// The result lands with a settle; errors land flat and honest — no success
// motion. The aria-live container persists across states so screen readers
// announce content changing inside it, not a region popping into existence.
function RunSection({ state }: { state: RunState }) {
  return (
    <div aria-live="polite">
      {state.status !== "idle" && <p className={styles.microlabel}>RUN</p>}
      {state.status === "running" && <p className={styles.missing}>Running…</p>}
      {state.status === "done" &&
        (state.display.ok ? (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            {state.display.blocks.map((b, i) => (
              <div key={i}>
                {b.label && <p className={styles.microlabel}>{b.label.toUpperCase()}</p>}
                <pre className={styles.code}>{b.text}</pre>
              </div>
            ))}
            {state.display.truncated && (
              <p className={styles.missing}>output capped at {MAX_RESULT_CHARS.toLocaleString("en-US")} characters</p>
            )}
          </motion.div>
        ) : (
          <div role="alert" className={styles.runError}>
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

function ToolView({ connection, id }: { connection: Connection; id: string }) {
  const { runs } = useRuns()
  const tool = connection.snapshot.tools.find((t) => t.name === id)
  if (!tool) return <p className={styles.missing}>Tool no longer present.</p>
  const rows = schemaRows(tool.inputSchema)
  const runClass = classifyTool(tool, connection.transportKind)
  return (
    <>
      <h2 className={styles.name}>{tool.name}</h2>
      {tool.description && <p className={styles.desc}>{tool.description}</p>}
      {runClass === "input-required" ? (
        <p className={styles.comingSoon}>inputs required — running these is coming</p>
      ) : (
        <RunSection state={runs[tool.name] ?? { status: "idle" }} />
      )}
      <p className={styles.microlabel}>ARGUMENTS</p>
      {rows.length === 0 ? (
        <p className={styles.missing}>No arguments</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">name</th>
              <th scope="col">type</th>
              <th scope="col">details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td className={styles.argName}>
                  {r.name}
                  {r.required && <span className={styles.req}> ✱</span>}
                </td>
                <td className={styles.argType}>
                  {friendlyType(r.type)}
                  {friendlyType(r.type) !== r.type && <span className={styles.rawType}>{r.type}</span>}
                </td>
                <td className={styles.argDesc}>
                  {r.description}
                  {r.enumValues && (
                    <span className={styles.chips}>
                      {r.enumValues.map((v) => (
                        <code key={v} className={styles.chip}>
                          {v}
                        </code>
                      ))}
                    </span>
                  )}
                  {r.defaultValue !== undefined && <span className={styles.default}> default {r.defaultValue}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <RawJson value={tool} />
    </>
  )
}

// Tools-only since the rail-browser redesign (2026-08-27): resources and
// prompts unfold in place in the rail and never reach the panel.
export default function DetailPanel({ connection, selected, onClose }: DetailPanelProps) {
  if (!selected || selected.kind !== "tool") return null
  return (
    <motion.aside
      className={styles.panel}
      initial={{ x: "110%" }}
      animate={{ x: 0 }}
      exit={{ x: "110%" }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
    >
      <button type="button" className={styles.close} aria-label="Close details" onClick={onClose}>
        ✕
      </button>
      <ToolView connection={connection} id={selected.id} />
    </motion.aside>
  )
}
