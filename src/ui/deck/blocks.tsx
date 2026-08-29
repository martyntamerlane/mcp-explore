import { useMemo, useState } from "react"
import { looksLikeMarkdown } from "../markdown/detect"
import Markdown from "../markdown/Markdown"
import type { ReadDisplay } from "../run/readResult"
import { MAX_RESULT_CHARS } from "../run/runResult"
import styles from "./Workspace.module.css"

/**
 * Shared render for the block lists that both reads and runs produce. Text is
 * rendered as React text nodes or, when it is markdown, as React elements built
 * from a parsed tree — never HTML — because every byte here came from an
 * untrusted server.
 */

/**
 * One text block. Markdown is detected and rendered; anything else keeps the
 * verbatim <pre> it always had. Detection is a heuristic over hostile input, so
 * it is always reversible: "Show raw" gives back the exact bytes the server
 * sent (spec 2026-08-29-markdown-rendering.md §4).
 */
export function TextBlock({ text, mime }: { text: string; mime?: string }) {
  const markdown = useMemo(() => looksLikeMarkdown(text, mime), [text, mime])
  const [raw, setRaw] = useState(false)

  if (!markdown) return <pre className={styles.code}>{text}</pre>

  return (
    <>
      <button type="button" className={styles.ghostButton} onClick={() => setRaw((r) => !r)}>
        {raw ? "Show rendered" : "Show raw"}
      </button>
      {raw ? <pre className={styles.code}>{text}</pre> : <Markdown text={text} />}
    </>
  )
}

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
          {b.text !== undefined && <TextBlock text={b.text} mime={b.mime} />}
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
