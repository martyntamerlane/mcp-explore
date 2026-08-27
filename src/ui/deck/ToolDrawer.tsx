import { useState } from "react"
import { motion } from "motion/react"
import type { ServerSnapshot, TransportKind } from "../../mcp/types"
import { useRuns, type RunState } from "../run/RunContext"
import { MAX_RESULT_CHARS } from "../run/runResult"
import { friendlyType, schemaRows } from "../schema"
import { classifyTool } from "./deckModel"
import styles from "./ToolDrawer.module.css"

/**
 * The console drawer (console-drawer + dark-mode spec §2): the tools' deep-dive
 * surface, docked inside the server boundary's bottom edge. Pushes the deck
 * body up — never overlays. One tool at a time; DeckView owns open/close and
 * the Esc precedence (disarm first, then close).
 */
export interface ToolDrawerProps {
  snapshot: ServerSnapshot
  transportKind: TransportKind
  toolId: string
  onClose: () => void
}

function RawJson({ value }: { value: unknown }) {
  // Closed <details> still puts its children in the DOM (only CSS hides them),
  // so render the dump only once the disclosure is opened (text-query safety).
  const [open, setOpen] = useState(false)
  const json = JSON.stringify(value, null, 2)
  return (
    <details className={styles.raw} open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>Raw JSON</summary>
      {open && (
        <>
          <button type="button" className={styles.copy} onClick={() => void navigator.clipboard?.writeText(json)}>
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
      {state.status === "idle" && <p className={styles.missing}>Run the tool to see its result here.</p>}
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

export default function ToolDrawer({ snapshot, transportKind, toolId, onClose }: ToolDrawerProps) {
  const { runs } = useRuns()
  const tool = snapshot.tools.find((t) => t.name === toolId)

  return (
    <div className={styles.drawer} role="region" aria-label={`tool details ${toolId}`}>
      <button type="button" className={styles.close} aria-label="Close details" onClick={onClose}>
        ✕
      </button>
      {!tool ? (
        <p className={styles.missing}>Tool no longer present.</p>
      ) : (
        <div className={styles.columns}>
          <div className={styles.identity}>
            <h2 className={styles.name}>{tool.name}</h2>
            {tool.description && <p className={styles.desc}>{tool.description}</p>}
            <RawJson value={tool} />
          </div>
          <div className={styles.argsCol}>
            <p className={styles.microlabel}>ARGUMENTS</p>
            <ArgsTable schema={tool.inputSchema} />
          </div>
          <div className={styles.runCol}>
            <p className={styles.microlabel}>RUN</p>
            {classifyTool(tool, transportKind) === "input-required" ? (
              <p className={styles.comingSoon}>inputs required — running these is coming</p>
            ) : (
              <RunSection state={runs[tool.name] ?? { status: "idle" }} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ArgsTable({ schema }: { schema: unknown }) {
  const rows = schemaRows(schema)
  if (rows.length === 0) return <p className={styles.missing}>No arguments</p>
  return (
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
  )
}
