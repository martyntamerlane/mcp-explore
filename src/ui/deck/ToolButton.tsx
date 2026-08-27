import { useId } from "react"
import type { DeckTool } from "./deckModel"
import Glyph from "./Glyph"
import styles from "./ToolButton.module.css"

export interface ToolButtonProps {
  tool: DeckTool
  armed: boolean
  running: boolean
  selected: boolean
  receded: boolean
  onPress: () => void
  onInfo: () => void
}

/**
 * One tool on the deck. The card wraps two sibling buttons (face + info) plus
 * an anchored tooltip — never nested interactive elements. Click semantics per
 * run class live in DeckView's useArm; this component only reports presses.
 */
export default function ToolButton({ tool, armed, running, selected, receded, onPress, onInfo }: ToolButtonProps) {
  const tipId = useId()
  return (
    <div
      className={styles.card}
      data-armed={armed || undefined}
      data-running={running || undefined}
      data-selected={selected || undefined}
      data-receded={receded || undefined}
      data-class={tool.runClass}
    >
      <button
        type="button"
        className={styles.face}
        aria-label={armed ? `Run ${tool.label}` : `tool ${tool.label}`}
        aria-pressed={tool.runClass === "arm" ? armed : undefined}
        aria-describedby={tool.blurb ? tipId : undefined}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onPress}
      >
        <Glyph kind="tool" />
        <span className={styles.name}>{armed ? `Run ${tool.label} ▸` : tool.label}</span>
        {tool.runClass === "input-required" && <span className={styles.needsInput}>needs input</span>}
      </button>
      <button
        type="button"
        className={styles.info}
        aria-label={`details ${tool.label}`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onInfo}
      >
        i
      </button>
      {tool.blurb && (
        <div role="tooltip" id={tipId} className={styles.tip}>
          {tool.blurb}
        </div>
      )}
    </div>
  )
}
