import { useLayoutEffect, useRef, useState } from "react"
import styles from "./Workspace.module.css"

/**
 * Long prose, clamped to a line count with the rest one click away.
 *
 * Overflow is **measured** rather than guessed from a character count: the clamp
 * is a line count, and lines depend on the measure, the face and the viewport.
 *
 * Written for the home view's `instructions` (TODO-23 — Hugging Face publishes
 * 1,555 characters, which arrived as a ~20-line wall that buried the counts
 * above it) and reused for a tool's description, where the same wall pushes the
 * argument form below the fold. Nothing is ever discarded: throwing away a
 * server's own words silently is not ours to do.
 */
export default function ClampedText({ text, lines, className }: { text: string; lines: 3 | 6; className: string }) {
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)
  const ref = useRef<HTMLParagraphElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    // Only meaningful while clamped; once expanded the previous answer stands.
    if (!expanded) setOverflows(el.scrollHeight > el.clientHeight + 1)
  }, [text, expanded])

  const clamp = lines === 3 ? styles.clamped3 : styles.clamped6
  return (
    <>
      <p ref={ref} className={expanded ? className : `${className} ${clamp}`}>
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
