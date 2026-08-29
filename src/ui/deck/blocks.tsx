import type { ReadDisplay } from "../run/readResult"
import { MAX_RESULT_CHARS } from "../run/runResult"
import styles from "./Workspace.module.css"

/**
 * Shared render for the block lists that both reads and runs produce. Text is
 * rendered as React text nodes only — never HTML — because every byte here came
 * from an untrusted server.
 */
export function ReadBlocks({ display }: { display: ReadDisplay }) {
  if (!display.ok) {
    return (
      <div role="alert" className={styles.errorBlock}>
        {display.blocks.map((b, i) => (
          <pre key={i} className={styles.code}>
            {b.text}
          </pre>
        ))}
      </div>
    )
  }
  return (
    <>
      {display.blocks.map((b, i) => (
        <div key={i} className={styles.block}>
          {b.label && <p className={styles.microlabel}>{b.label.toUpperCase()}</p>}
          {b.text !== undefined && <pre className={styles.code}>{b.text}</pre>}
          {b.image && <img className={styles.image} src={b.image.src} alt={b.image.alt} />}
        </div>
      ))}
      {display.truncated && <Truncated />}
    </>
  )
}

export function Truncated() {
  return <p className={styles.quiet}>output capped at {MAX_RESULT_CHARS.toLocaleString("en-US")} characters</p>
}
