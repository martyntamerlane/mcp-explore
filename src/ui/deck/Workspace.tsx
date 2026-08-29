import { motion, useReducedMotion } from "motion/react"
import type { ServerSnapshot, TransportKind } from "../../mcp/types"
import type { Values } from "../form/argValues"
import type { EntitySelection } from "../stage"
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
  onGetPrompt: (name: string, args: Record<string, string>) => void
}

function subjectKey(selection: EntitySelection | null): string {
  return selection === null ? "home" : `${selection.kind}:${selection.id}`
}

export default function Workspace({
  snapshot,
  transportKind,
  selection,
  values,
  onValueChange,
  onRun,
  onGetPrompt,
}: WorkspaceProps) {
  const reduced = useReducedMotion()

  const tool = selection?.kind === "tool" ? snapshot.tools.find((t) => t.name === selection.id) : undefined
  const resource = selection?.kind === "resource" ? snapshot.resources.find((r) => r.uri === selection.id) : undefined
  const prompt = selection?.kind === "prompt" ? snapshot.prompts.find((p) => p.name === selection.id) : undefined
  const gone = selection !== null && !tool && !resource && !prompt

  return (
    <section className={styles.workspace} aria-label="Workspace" aria-live="polite">
      {/* Keyed, not wrapped in AnimatePresence: the outgoing subject has nothing
          to say once it is gone, and waiting on its exit would delay the new one. */}
      <motion.div
        key={subjectKey(selection)}
        className={styles.subject}
        initial={reduced ? false : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.16, ease: "easeOut" }}
      >
        {selection === null && <HomeView snapshot={snapshot} transportKind={transportKind} />}
        {tool && (
          <ToolView tool={tool} values={values} onChange={onValueChange} onRun={(args) => onRun(tool.name, args)} />
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
      </motion.div>
    </section>
  )
}
