import { useMemo, useState } from "react"
import { useReads } from "../run/ReadContext"
import { useRuns } from "../run/RunContext"
import { fieldSpecs, initialValues, type Values } from "../form/argValues"
import type { EntitySelection, StageProps } from "../stage"
import BrowseColumn from "./BrowseColumn"
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
}: StageProps) {
  const model = useMemo(() => buildDeckModel(snapshot), [snapshot])
  const { run } = useRuns()
  const { read } = useReads()
  const [valuesBySubject, setValuesBySubject] = useState<Record<string, Values>>({})

  // Keys are the browse column's job now (interaction roadmap S1) — Escape
  // included, since it first clears the filter and only then returns home.

  const values = selection === null ? {} : (valuesBySubject[subjectKey(selection)] ?? {})

  const setValue = (name: string, value: string) => {
    if (selection === null) return
    const key = subjectKey(selection)
    setValuesBySubject((all) => ({ ...all, [key]: { ...(all[key] ?? {}), [name]: value } }))
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

  return (
    <div className={styles.stage}>
      <BrowseColumn
        model={model}
        query={query}
        onQuery={onQuery}
        onFocusFilter={onFocusFilter}
        selection={selection}
        onSelect={select}
      />
      <Workspace
        snapshot={snapshot}
        transportKind={transportKind}
        selection={selection}
        values={values}
        onValueChange={setValue}
        onRun={run}
        onGetPrompt={(name, args) => read("prompt", name, args)}
      />
    </div>
  )
}
