import { useMemo } from "react"
import { motion, useReducedMotion } from "motion/react"
import type { ServerSnapshot, TransportKind } from "../../mcp/types"
import type { Values } from "../form/argValues"
import { readKey, useReads } from "../run/ReadContext"
import { useRuns } from "../run/RunContext"
import { viewedRecord } from "../run/runHistory"
import type { EntitySelection } from "../stage"
import Outline from "./Outline"
import { outlineOf, worthShowing, type OutlineSource } from "./resultOutline"
import HomeView from "./HomeView"
import PromptView from "./PromptView"
import ResourceView from "./ResourceView"
import ToolView from "./ToolView"
import styles from "./Workspace.module.css"

/**
 * The workspace (tool-first workspace spec §3.3): permanent furniture holding
 * exactly one subject. It never appears, slides in or overlays — only its
 * contents change, and they cross-fade.
 */
export interface WorkspaceProps {
  snapshot: ServerSnapshot
  transportKind: TransportKind
  selection: EntitySelection | null
  values: Values
  onValueChange: (name: string, value: string) => void
  onRun: (toolName: string, args: Record<string, unknown>) => void
  /** Refill the current tool's form from a past run's arguments. */
  onRestoreArgs: (args: Record<string, unknown>) => void
  onGetPrompt: (name: string, args: Record<string, string>) => void
}

function subjectKey(selection: EntitySelection | null): string {
  return selection === null ? "home" : `${selection.kind}:${selection.id}`
}

// One shared empty array, so "no result yet" is a stable reference the outline's
// useMemo can compare rather than a new [] every render.
const NO_BLOCKS: readonly OutlineSource[] = []

const readBlocks = (state: ReturnType<typeof useReads>["reads"][string] | undefined): readonly OutlineSource[] =>
  state?.status === "done" && state.display.ok ? state.display.blocks : NO_BLOCKS

export default function Workspace({
  snapshot,
  transportKind,
  selection,
  values,
  onValueChange,
  onRun,
  onRestoreArgs,
  onGetPrompt,
}: WorkspaceProps) {
  const reduced = useReducedMotion()
  const { runs } = useRuns()
  const { reads } = useReads()

  const tool = selection?.kind === "tool" ? snapshot.tools.find((t) => t.name === selection.id) : undefined
  const resource = selection?.kind === "resource" ? snapshot.resources.find((r) => r.uri === selection.id) : undefined
  const prompt = selection?.kind === "prompt" ? snapshot.prompts.find((p) => p.name === selection.id) : undefined
  const gone = selection !== null && !tool && !resource && !prompt

  /**
   * The blocks currently on screen for this subject, straight out of state so
   * the reference is stable and the outline is parsed once per result rather
   * than once per render. Errors have no headings and no outline.
   */
  const blocks: readonly OutlineSource[] = tool
    ? (viewedRecord(runs, tool.name)?.display?.ok === true
        ? viewedRecord(runs, tool.name)?.display?.blocks
        : undefined) ?? NO_BLOCKS
    : resource || prompt
      ? readBlocks(reads[readKey(resource ? "resource" : "prompt", resource ? resource.uri : prompt!.name)])
      : NO_BLOCKS
  const entries = useMemo(() => outlineOf(blocks), [blocks])

  return (
    <section className={styles.workspace} aria-label="Workspace" aria-live="polite" data-scroller="">
      {/* Keyed, not wrapped in AnimatePresence: the outgoing subject has nothing
          to say once it is gone, and waiting on its exit would delay the new one. */}
      <motion.div
        key={subjectKey(selection)}
        className={styles.subject}
        initial={reduced ? false : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.16, ease: "easeOut" }}
      >
        <div className={styles.content}>
          {selection === null && <HomeView snapshot={snapshot} transportKind={transportKind} />}
          {tool && (
            <ToolView
              tool={tool}
              values={values}
              onChange={onValueChange}
              onRun={(args) => onRun(tool.name, args)}
              onRestore={onRestoreArgs}
            />
          )}
          {resource && <ResourceView resource={resource} />}
          {prompt && (
            <PromptView
              prompt={prompt}
              values={values}
              onChange={onValueChange}
              onGet={(args) => onGetPrompt(prompt.name, args)}
            />
          )}
          {gone && <p className={styles.quiet}>That {selection.kind} is no longer present on this server.</p>}
        </div>
        {worthShowing(entries) && <Outline entries={entries} />}
      </motion.div>
    </section>
  )
}
