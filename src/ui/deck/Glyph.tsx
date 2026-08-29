import type { EntityKind } from "../stage"
import styles from "./Glyph.module.css"

/**
 * Entity shape coding (retained): tool = circle, resource = square, prompt =
 * diamond. Deliberately colourless — shapes carry no fill or stroke attribute,
 * so the surrounding row decides: hollow ink at rest, filled accent when it is
 * the workspace's subject (tool-first workspace spec §3.2).
 */
export default function Glyph({ kind }: { kind: EntityKind }) {
  return (
    <svg className={styles.glyph} data-glyph viewBox="-10 -10 20 20" aria-hidden="true">
      {kind === "tool" && <circle r={5.5} />}
      {kind === "resource" && <rect x={-5} y={-5} width={10} height={10} rx={2.5} />}
      {kind === "prompt" && <rect x={-4.6} y={-4.6} width={9.2} height={9.2} rx={1.8} transform="rotate(45)" />}
    </svg>
  )
}
