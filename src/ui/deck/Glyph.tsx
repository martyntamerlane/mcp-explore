import type { EntityKind } from "../stage"
import styles from "./Glyph.module.css"

const FILL: Record<EntityKind, string> = {
  tool: "var(--tool)",
  resource: "var(--resource)",
  prompt: "var(--prompt)",
}

/** Entity shape coding (retained): tool = circle, resource = square, prompt = diamond. */
export default function Glyph({ kind }: { kind: EntityKind }) {
  const fill = FILL[kind]
  return (
    <svg className={styles.glyph} viewBox="-10 -10 20 20" aria-hidden="true">
      {kind === "tool" && <circle r={6} fill={fill} />}
      {kind === "resource" && <rect x={-5.5} y={-5.5} width={11} height={11} rx={3} fill={fill} />}
      {kind === "prompt" && <rect x={-5} y={-5} width={10} height={10} rx={2} transform="rotate(45)" fill={fill} />}
    </svg>
  )
}
