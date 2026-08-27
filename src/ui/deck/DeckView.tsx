import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import type { StageProps } from "../stage"
import { useRuns } from "../run/RunContext"
import { ARM_TIMEOUT_MS, pressTool } from "./armState"
import { igniteContainer, igniteItem } from "./choreography"
import { buildDeckModel, type RunClass } from "./deckModel"
import Prism from "./Prism"
import Rail from "./Rail"
import ToolButton from "./ToolButton"
import ToolDrawer from "./ToolDrawer"
import styles from "./DeckView.module.css"

/** Tools shown before the "+ N more" expander (an active filter bypasses the cap). */
export const TOOLS_PREVIEW_MAX = 24

// Exactly one tool may be armed; Esc, pointerdown elsewhere, scroll, panel-open,
// and a 4s timeout all disarm (redesign spec §4).
function useArm(onFire: (id: string) => void, selectionKey: string | null, timeoutMs: number) {
  const [armedId, setArmedId] = useState<string | null>(null)

  const press = (id: string, runClass: RunClass) => {
    const next = pressTool(armedId, id, runClass)
    setArmedId(next.armedId)
    if (next.fire) onFire(next.fire)
  }

  useEffect(() => {
    if (armedId === null) return
    const disarm = () => setArmedId(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") disarm()
    }
    const timer = setTimeout(disarm, timeoutMs)
    window.addEventListener("keydown", onKey)
    window.addEventListener("scroll", disarm, { capture: true, passive: true })
    window.addEventListener("pointerdown", disarm)
    return () => {
      clearTimeout(timer)
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("scroll", disarm, { capture: true })
      window.removeEventListener("pointerdown", disarm)
    }
  }, [armedId, timeoutMs])

  // Opening / switching the detail panel disarms.
  useEffect(() => setArmedId(null), [selectionKey])

  return { armedId, press, disarm: () => setArmedId(null) }
}

export default function DeckView({
  snapshot,
  transportKind,
  selection,
  onSelect,
  armTimeoutMs = ARM_TIMEOUT_MS,
}: StageProps & { armTimeoutMs?: number }) {
  const model = useMemo(() => buildDeckModel(snapshot, transportKind), [snapshot, transportKind])
  const { runs, run } = useRuns()
  const [query, setQuery] = useState("")
  const [toolsExpanded, setToolsExpanded] = useState(false)
  const [railExpanded, setRailExpanded] = useState<Partial<Record<"resource" | "prompt", boolean>>>({})

  const fire = (id: string) => {
    run(id)
    onSelect({ kind: "tool", id })
  }
  const { armedId, press } = useArm(fire, selection ? `${selection.kind}:${selection.id}` : null, armTimeoutMs)

  // Input-required tools have no run affordance — their whole face opens details.
  const handlePress = (tool: (typeof model.tools)[number]) => {
    if (tool.runClass === "input-required") {
      onSelect({ kind: "tool", id: tool.id })
      return
    }
    press(tool.id, tool.runClass)
  }

  // The drawer is the tools' deep-dive surface; rail selections no longer exist.
  const drawerTool = selection?.kind === "tool" ? selection.id : null

  // Esc precedence (spec §2): if a tool is armed, Esc disarms (useArm's own
  // listener); only an unarmed Esc closes the drawer. Both handlers see the
  // same pre-dispatch armedId, so one keypress never does both.
  useEffect(() => {
    if (drawerTool === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && armedId === null) onSelect(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [drawerTool, armedId, onSelect])

  const q = query.trim().toLowerCase()
  const matches = (label: string) => q === "" || label.toLowerCase().includes(q)

  const capped = !toolsExpanded && q === "" && model.tools.length > TOOLS_PREVIEW_MAX
  const visibleTools = capped ? model.tools.slice(0, TOOLS_PREVIEW_MAX) : model.tools

  // prefers-reduced-motion floor: no entrance at all — content is simply there.
  const reduced = useReducedMotion()
  const entrance = reduced ? false : undefined

  return (
    <motion.section
      className={styles.boundary}
      data-emphasis={model.emphasis}
      role="region"
      aria-label={`Server ${snapshot.serverInfo.name}`}
      initial={entrance ?? { opacity: 0, scale: 0.988 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <header className={styles.deckHeader}>
        <Prism className={styles.emblem} />
        <span className={styles.serverName}>{snapshot.serverInfo.name}</span>
        <span className={styles.chip}>v{snapshot.serverInfo.version}</span>
        <span className={styles.chip}>{transportKind}</span>
        <input
          aria-label="Filter items"
          className={styles.filter}
          placeholder="filter…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          spellCheck={false}
        />
      </header>
      <div className={styles.body}>
        <div className={styles.gridSection} role="group" aria-label="Tools">
          <header className={styles.sectionHeader}>{`TOOLS · ${model.tools.length}`}</header>
          <p className={styles.gloss}>actions it can perform</p>
          {model.tools.length === 0 && <p className={styles.empty}>none</p>}
          <motion.div
            className={styles.grid}
            variants={igniteContainer(0.25)}
            initial={entrance ?? "hidden"}
            animate="show"
          >
            {visibleTools.map((tool) => (
              <motion.div key={tool.id} className={styles.gridItem} variants={reduced ? undefined : igniteItem}>
                <ToolButton
                  tool={tool}
                  armed={armedId === tool.id}
                  running={runs[tool.id]?.status === "running"}
                  selected={selection?.kind === "tool" && selection.id === tool.id}
                  receded={!matches(tool.label)}
                  onPress={() => handlePress(tool)}
                  onInfo={() => onSelect({ kind: "tool", id: tool.id })}
                />
              </motion.div>
            ))}
          </motion.div>
          {q === "" && model.tools.length > TOOLS_PREVIEW_MAX && (
            <button
              type="button"
              className={styles.more}
              aria-label={capped ? `Show all ${model.tools.length} Tools` : "Show fewer Tools"}
              onClick={() => setToolsExpanded((e) => !e)}
            >
              {capped ? `+ ${model.tools.length - TOOLS_PREVIEW_MAX} more` : "− show fewer"}
            </button>
          )}
        </div>
        <Rail
          groups={model.rail}
          matches={matches}
          queryActive={q !== ""}
          expanded={railExpanded}
          onToggleExpand={(kind) => setRailExpanded((e) => ({ ...e, [kind]: !e[kind] }))}
          reduced={reduced ?? false}
        />
      </div>
      <AnimatePresence initial={false}>
        {drawerTool !== null && (
          <motion.div
            key="drawer"
            className={styles.drawerFold}
            initial={reduced ? false : { height: 0 }}
            animate={{ height: "auto" }}
            exit={reduced ? undefined : { height: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <ToolDrawer
              snapshot={snapshot}
              transportKind={transportKind}
              toolId={drawerTool}
              onClose={() => onSelect(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  )
}
