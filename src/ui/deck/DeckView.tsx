import { useMemo, useState } from "react"
import { useMode } from "../ModeContext"
import { useReads } from "../run/ReadContext"
import { useRuns } from "../run/RunContext"
import { fieldSpecs, initialValues, valuesFromArgs, type Values } from "../form/argValues"
import type { EntitySelection, StageProps } from "../stage"
import BrowseColumn from "./BrowseColumn"
import { availableCommands, runCommand, type Command } from "./commands"
import { useRawView } from "./rawView"
import { buildDeckModel } from "./deckModel"
import Workspace from "./Workspace"
import styles from "./DeckView.module.css"

const subjectKey = (selection: EntitySelection) => `${selection.kind}:${selection.id}`

/**
 * The default stage (tool-first workspace spec §3): a permanent browse column
 * and a permanent workspace, with `selection === null` meaning home.
 *
 * Form values live here, keyed by subject, so a part-filled form survives
 * switching subject and coming back. They are session state only — nothing is
 * persisted, because arguments can carry anything the user typed.
 */
export default function DeckView({
  snapshot,
  transportKind,
  selection,
  onSelect,
  query,
  onQuery,
  onFocusFilter,
  onCopyLink,
  onDisconnect,
}: StageProps) {
  const model = useMemo(() => buildDeckModel(snapshot), [snapshot])
  const { run } = useRuns()
  const { read } = useReads()
  const { mode, toggle } = useMode()
  const rawView = useRawView()
  const [valuesBySubject, setValuesBySubject] = useState<Record<string, Values>>({})

  // Keys are the browse column's job now (interaction roadmap S1) — Escape
  // included, since it first clears the filter and only then returns home.

  const values = selection === null ? {} : (valuesBySubject[subjectKey(selection)] ?? {})

  const setValue = (name: string, value: string) => {
    if (selection === null) return
    const key = subjectKey(selection)
    setValuesBySubject((all) => ({
      ...all,
      [key]: { ...(all[key] ?? {}), [name]: value },
    }))
  }

  /**
   * Selecting is the whole click contract (spec §4): a zero-argument tool runs
   * on selection — including when it is already the subject, which is how a
   * result is refreshed — while anything else simply opens.
   */
  const select = (next: EntitySelection | null) => {
    onSelect(next)
    if (next === null || next.kind !== "tool") return
    const tool = snapshot.tools.find((t) => t.name === next.id)
    if (!tool) return
    const specs = fieldSpecs(tool.inputSchema)
    if (specs.length === 0) {
      run(next.id)
      return
    }
    // Seed the form with the schema's defaults the first time it is opened.
    const key = subjectKey(next)
    setValuesBySubject((all) => (key in all ? all : { ...all, [key]: initialValues(specs) }))
  }

  /**
   * Restoring a past run refills the form that produced it, so "edit and re-run"
   * is one click (interaction roadmap S3). It replaces the whole value set
   * rather than merging: a run is a complete set of arguments, and half-merging
   * it with what is currently typed would produce a form matching neither.
   */
  const restoreArgs = (args: Record<string, unknown>) => {
    if (selection === null || selection.kind !== "tool") return
    const tool = snapshot.tools.find((t) => t.name === selection.id)
    if (!tool) return
    const restored = valuesFromArgs(fieldSpecs(tool.inputSchema), args)
    setValuesBySubject((all) => ({
      ...all,
      [subjectKey(selection)]: restored,
    }))
  }

  /**
   * Command mode's list (interaction roadmap S2). Assembled here because this is
   * the one place that can see all of it: the selection, the theme, and whether
   * anything on screen is rendered markdown. Every entry is a second route to an
   * action that already exists — no command adds a capability.
   */
  const commands = availableCommands({
    hasSelection: selection !== null,
    mode,
    raw: rawView.raw,
    hasRenderable: rawView.renderable > 0,
  })

  const dispatch = (command: Command) =>
    runCommand(command.id, {
      home: () => select(null),
      copyLink: onCopyLink,
      setRaw: rawView.setAll,
      toggleTheme: toggle,
      disconnect: onDisconnect,
    })

  return (
    <div className={styles.stage}>
      <BrowseColumn
        model={model}
        query={query}
        onQuery={onQuery}
        onFocusFilter={onFocusFilter}
        selection={selection}
        onSelect={select}
        commands={commands}
        onRunCommand={dispatch}
      />
      <Workspace
        snapshot={snapshot}
        transportKind={transportKind}
        selection={selection}
        values={values}
        onValueChange={setValue}
        onRun={run}
        onRestoreArgs={restoreArgs}
        onGetPrompt={(name, args) => read("prompt", name, args)}
      />
    </div>
  )
}
