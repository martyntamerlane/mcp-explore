import { useLayoutEffect, useRef, useState } from "react"
import type { ServerSnapshot, TransportKind } from "../../mcp/types"
import styles from "./Workspace.module.css"

/**
 * Home — the workspace's resting subject (tool-first workspace spec §6). The
 * server's own `instructions` have been captured in the snapshot since the
 * scaffold and were never shown anywhere; this is where they live.
 */

/**
 * A server's `instructions` are unbounded: Hugging Face publishes 1,555
 * characters, which arrived as a ~20-line wall that buried the counts above it
 * (TODO-23). Clamped to six lines with the rest a click away — never truncated,
 * because throwing away a server's own words silently is not ours to do.
 *
 * Overflow is measured rather than guessed from a character count: the clamp is
 * a line count and lines depend on the measure, the face and the viewport.
 */
function Instructions({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)
  const ref = useRef<HTMLParagraphElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    // Only meaningful while clamped; once expanded the previous answer stands.
    if (!expanded) setOverflows(el.scrollHeight > el.clientHeight + 1)
  }, [text, expanded])

  return (
    <>
      <p ref={ref} className={expanded ? styles.instructions : `${styles.instructions} ${styles.clamped}`}>
        {text}
      </p>
      {overflows && (
        <button type="button" className={styles.ghostButton} onClick={() => setExpanded((e) => !e)}>
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </>
  )
}

export default function HomeView({
  snapshot,
  transportKind,
}: {
  snapshot: ServerSnapshot
  transportKind: TransportKind
}) {
  const counts = [
    { label: "tools", n: snapshot.tools.length },
    { label: "resources", n: snapshot.resources.length },
    { label: "prompts", n: snapshot.prompts.length },
  ]
  return (
    <>
      <h2 className={styles.title}>{snapshot.serverInfo.name}</h2>
      <p className={styles.subtitle}>
        version {snapshot.serverInfo.version} · connected over {transportKind}
      </p>

      <dl className={styles.counts}>
        {counts.map((c) => (
          <div key={c.label} className={styles.countCell}>
            <dt className={styles.countLabel}>{c.label}</dt>
            <dd className={styles.countValue}>{c.n}</dd>
          </div>
        ))}
      </dl>

      <p className={styles.microlabel}>INSTRUCTIONS</p>
      {snapshot.instructions ? (
        <Instructions text={snapshot.instructions} />
      ) : (
        <p className={styles.quiet}>This server publishes no instructions.</p>
      )}
    </>
  )
}
