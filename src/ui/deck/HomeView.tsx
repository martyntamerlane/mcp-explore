import type { ServerSnapshot, TransportKind } from "../../mcp/types"
import ClampedText from "./ClampedText"
import styles from "./Workspace.module.css"

/**
 * Home — the workspace's resting subject (tool-first workspace spec §6). The
 * server's own `instructions` have been captured in the snapshot since the
 * scaffold and were never shown anywhere; this is where they live.
 */

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
        <ClampedText text={snapshot.instructions} lines={6} className={styles.instructions} />
      ) : (
        <p className={styles.quiet}>This server publishes no instructions.</p>
      )}
    </>
  )
}
