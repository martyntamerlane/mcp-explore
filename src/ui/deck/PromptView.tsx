import { useEffect } from "react"
import type { Prompt } from "@modelcontextprotocol/sdk/types.js"
import ArgsForm from "../form/ArgsForm"
import type { FieldSpec, Values } from "../form/argValues"
import { readKey, useReads } from "../run/ReadContext"
import { Elapsed, ReadBlocks } from "./blocks"
import ClampedText from "./ClampedText"
import Glyph from "./Glyph"
import styles from "./Workspace.module.css"

/**
 * A prompt as the workspace's subject (tool-first workspace spec §6). Prompt
 * arguments are always strings per the MCP spec, so they map to plain text
 * fields through the same form component the tools use.
 */
export function promptSpecs(prompt: Prompt): FieldSpec[] {
  return (Array.isArray(prompt.arguments) ? prompt.arguments : []).map((a) => ({
    name: a.name,
    kind: "text" as const,
    required: a.required === true,
    ...(typeof a.description === "string" ? { description: a.description } : {}),
    rawType: "string",
    initial: "",
  }))
}

export interface PromptViewProps {
  prompt: Prompt
  values: Values
  onChange: (name: string, value: string) => void
  onGet: (args: Record<string, string>) => void
}

export default function PromptView({ prompt, values, onChange, onGet }: PromptViewProps) {
  const { reads } = useReads()
  const specs = promptSpecs(prompt)
  const state = reads[readKey("prompt", prompt.name)]

  const missing = specs.filter((s) => s.required && (values[s.name] ?? "").trim() === "").map((s) => s.name)
  const args = Object.fromEntries(
    specs.map((s) => [s.name, values[s.name] ?? ""]).filter(([, v]) => v.trim() !== ""),
  ) as Record<string, string>

  // A prompt with no arguments loads on selection; one with arguments waits,
  // because its messages depend on values only the user can supply.
  useEffect(() => {
    if (specs.length === 0) onGet({})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt.name])

  return (
    <>
      {/* Same three zones as a tool (spec 2026-08-30-tool-legibility.md) — a
          prompt asks for input and gives something back in exactly the same
          shape, so it must not read as a different application. */}
      <div className={styles.subjectHead} data-kind="prompt">
        <Glyph kind="prompt" />
        <h2 className={styles.title}>{prompt.name}</h2>
        {specs.length > 0 && (
          <span className={styles.headBadge}>
            {specs.length} {specs.length === 1 ? "argument" : "arguments"}
          </span>
        )}
      </div>
      {prompt.description && <ClampedText text={prompt.description} lines={3} className={styles.description} />}

      {specs.length > 0 && (
        <div className={styles.form}>
          <div className={styles.inputHead}>
            <p className={styles.microlabel}>{specs.some((s) => s.required) ? "INPUT REQUIRED" : "INPUT"}</p>
            <div className={styles.runRow}>
              {missing.length > 0 && <span className={styles.quiet}>fill {missing.join(", ")} to fetch</span>}
              <button
                type="button"
                className={styles.run}
                data-kind="prompt"
                disabled={missing.length > 0}
                onClick={() => onGet(args)}
              >
                Get prompt
              </button>
            </div>
          </div>
          <ArgsForm specs={specs} values={values} onChange={onChange} errors={{}} idPrefix={`prompt-${prompt.name}`} />
        </div>
      )}

      <section className={styles.resultArea} aria-live="polite" aria-label="Messages">
        <p className={styles.microlabel}>MESSAGES</p>
        {state === undefined ? (
          <p className={styles.quiet}>Fill the arguments and fetch to see the messages.</p>
        ) : state.status === "loading" ? (
          <p className={styles.quiet}>
            Loading… <Elapsed since={state.startedAt} />
          </p>
        ) : (
          <ReadBlocks display={state.display} />
        )}
      </section>
    </>
  )
}
