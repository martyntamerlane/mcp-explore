import { useId } from "react"
import { motion } from "motion/react"
import type { RailGroup, RailItem } from "./deckModel"
import type { StageProps } from "../stage"
import { igniteContainer, igniteItem } from "./DeckView"
import Glyph from "./Glyph"
import styles from "./DeckView.module.css"

export const RAIL_PREVIEW_MAX = 10

function RailEntry({
  item,
  selected,
  receded,
  onSelect,
}: {
  item: RailItem
  selected: boolean
  receded: boolean
  onSelect: () => void
}) {
  const tipId = useId()
  return (
    <div className={styles.railEntry} data-receded={receded || undefined}>
      <button
        type="button"
        className={styles.railButton}
        aria-label={`${item.kind} ${item.label}`}
        aria-pressed={selected}
        aria-describedby={item.blurb ? tipId : undefined}
        onClick={onSelect}
      >
        <Glyph kind={item.kind} />
        <span className={styles.railName}>{item.label}</span>
      </button>
      {item.blurb && (
        <div role="tooltip" id={tipId} className={styles.tip}>
          {item.blurb}
        </div>
      )}
    </div>
  )
}

export default function Rail({
  groups,
  selection,
  onSelect,
  matches,
  queryActive,
  expanded,
  onToggleExpand,
  reduced,
}: {
  groups: RailGroup[]
  selection: StageProps["selection"]
  onSelect: StageProps["onSelect"]
  matches: (label: string) => boolean
  queryActive: boolean
  expanded: Partial<Record<"resource" | "prompt", boolean>>
  onToggleExpand: (kind: "resource" | "prompt") => void
  reduced: boolean
}) {
  return (
    <div className={styles.rail}>
      {groups.map((group, gi) => {
        const capped = !expanded[group.kind] && !queryActive && group.items.length > RAIL_PREVIEW_MAX
        const visible = capped ? group.items.slice(0, RAIL_PREVIEW_MAX) : group.items
        return (
          <motion.section
            key={group.kind}
            className={styles.railGroup}
            data-kind={group.kind}
            // the rail follows the grid in the power-on cascade
            variants={igniteContainer(0.55 + gi * 0.15)}
            initial={reduced ? false : "hidden"}
            animate="show"
          >
            <header className={styles.sectionHeader}>{`${group.label.toUpperCase()} · ${group.items.length}`}</header>
            <p className={styles.gloss}>{group.gloss}</p>
            {group.items.length === 0 && <p className={styles.empty}>none</p>}
            {visible.map((item) => (
              <motion.div key={`${item.kind}:${item.id}`} variants={reduced ? undefined : igniteItem}>
                <RailEntry
                  item={item}
                  selected={selection?.kind === item.kind && selection?.id === item.id}
                  receded={!matches(item.label)}
                  onSelect={() => onSelect({ kind: item.kind, id: item.id })}
                />
              </motion.div>
            ))}
            {!queryActive && group.items.length > RAIL_PREVIEW_MAX && (
              <button
                type="button"
                className={styles.more}
                aria-label={capped ? `Show all ${group.items.length} ${group.label}` : `Show fewer ${group.label}`}
                onClick={() => onToggleExpand(group.kind)}
              >
                {capped ? `+ ${group.items.length - RAIL_PREVIEW_MAX} more` : "− show fewer"}
              </button>
            )}
          </motion.section>
        )
      })}
    </div>
  )
}
