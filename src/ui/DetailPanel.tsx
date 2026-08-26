import { useState } from "react"
import type { Connection } from "../mcp/types"
import type { EntitySelection } from "./stage"
import { friendlyType, schemaRows } from "./schema"
import styles from "./DetailPanel.module.css"

export interface DetailPanelProps {
  connection: Connection
  selected: EntitySelection | null
  onClose: () => void
}

type LoadedContents =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "loaded"; items: { mimeType?: string; text?: string; blob?: string; uri: string }[] }

function RawJson({ value }: { value: unknown }) {
  // Closed <details> still puts its children in the DOM (only CSS hides them), so
  // an always-rendered <pre> dump collides in text queries with fields also shown
  // above (e.g. description). Render the dump only once the disclosure is opened.
  const [open, setOpen] = useState(false)
  const json = JSON.stringify(value, null, 2)
  return (
    <details className={styles.raw} open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>Raw JSON</summary>
      {open && (
        <>
          <button
            type="button"
            className={styles.copy}
            onClick={() => void navigator.clipboard?.writeText(json)}
          >
            Copy
          </button>
          <pre className={styles.code}>{json}</pre>
        </>
      )}
    </details>
  )
}

function ToolView({ connection, id }: { connection: Connection; id: string }) {
  const tool = connection.snapshot.tools.find((t) => t.name === id)
  if (!tool) return <p className={styles.missing}>Tool no longer present.</p>
  const rows = schemaRows(tool.inputSchema)
  return (
    <>
      <h2 className={styles.name}>{tool.name}</h2>
      {tool.description && <p className={styles.desc}>{tool.description}</p>}
      <p className={styles.microlabel}>ARGUMENTS</p>
      {rows.length === 0 ? (
        <p className={styles.missing}>No arguments</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">name</th>
              <th scope="col">type</th>
              <th scope="col">details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td className={styles.argName}>
                  {r.name}
                  {r.required && <span className={styles.req}> ✱</span>}
                </td>
                <td className={styles.argType}>
                  {friendlyType(r.type)}
                  {friendlyType(r.type) !== r.type && <span className={styles.rawType}>{r.type}</span>}
                </td>
                <td className={styles.argDesc}>
                  {r.description}
                  {r.enumValues && (
                    <span className={styles.chips}>
                      {r.enumValues.map((v) => (
                        <code key={v} className={styles.chip}>
                          {v}
                        </code>
                      ))}
                    </span>
                  )}
                  {r.defaultValue !== undefined && <span className={styles.default}> default {r.defaultValue}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <RawJson value={tool} />
    </>
  )
}

function ResourceView({ connection, id }: { connection: Connection; id: string }) {
  const resource = connection.snapshot.resources.find((r) => r.uri === id)
  const [contents, setContents] = useState<LoadedContents>({ state: "idle" })
  if (!resource) return <p className={styles.missing}>Resource no longer present.</p>

  async function load() {
    setContents({ state: "loading" })
    try {
      const result = await connection.client.readResource({ uri: id })
      setContents({
        state: "loaded",
        items: result.contents.map((c) => ({
          uri: c.uri,
          mimeType: typeof c.mimeType === "string" ? c.mimeType : undefined,
          text: "text" in c && typeof c.text === "string" ? c.text : undefined,
          blob: "blob" in c && typeof c.blob === "string" ? c.blob : undefined,
        })),
      })
    } catch (err) {
      setContents({ state: "error", message: err instanceof Error ? err.message : String(err) })
    }
  }

  return (
    <>
      <h2 className={styles.name}>{resource.name ?? resource.uri}</h2>
      <p className={styles.mono}>{resource.uri}</p>
      {resource.mimeType && <p className={styles.microlabel}>{resource.mimeType}</p>}
      {resource.description && <p className={styles.desc}>{resource.description}</p>}
      {contents.state === "idle" && (
        <button type="button" className={styles.action} onClick={() => void load()}>
          Load contents
        </button>
      )}
      {contents.state === "loading" && <p className={styles.missing}>Loading…</p>}
      {contents.state === "error" && <p className={styles.error}>{contents.message}</p>}
      {contents.state === "loaded" &&
        contents.items.map((item, i) => (
          <div key={i}>
            {item.text !== undefined && <pre className={styles.code}>{prettify(item.text, item.mimeType)}</pre>}
            {item.blob !== undefined && item.mimeType?.startsWith("image/") && (
              <img className={styles.img} alt={item.uri} src={`data:${item.mimeType};base64,${item.blob}`} />
            )}
            {item.blob !== undefined && !item.mimeType?.startsWith("image/") && (
              <p className={styles.missing}>Binary contents ({item.mimeType ?? "unknown type"})</p>
            )}
          </div>
        ))}
      <RawJson value={resource} />
    </>
  )
}

function prettify(text: string, mimeType?: string): string {
  if (mimeType === "application/json") {
    try {
      return JSON.stringify(JSON.parse(text), null, 2)
    } catch {
      return text
    }
  }
  return text
}

function PromptView({ connection, id }: { connection: Connection; id: string }) {
  const prompt = connection.snapshot.prompts.find((p) => p.name === id)
  if (!prompt) return <p className={styles.missing}>Prompt no longer present.</p>
  return (
    <>
      <h2 className={styles.name}>{prompt.name}</h2>
      {prompt.description && <p className={styles.desc}>{prompt.description}</p>}
      <p className={styles.microlabel}>ARGUMENTS</p>
      {!prompt.arguments || prompt.arguments.length === 0 ? (
        <p className={styles.missing}>No arguments</p>
      ) : (
        <ul className={styles.promptArgs}>
          {prompt.arguments.map((a) => (
            <li key={a.name}>
              <span className={styles.argName}>
                {a.name}
                {a.required && <span className={styles.req}> ✱</span>}
              </span>
              {a.description && <span className={styles.argDesc}> {a.description}</span>}
            </li>
          ))}
        </ul>
      )}
      <RawJson value={prompt} />
    </>
  )
}

export default function DetailPanel({ connection, selected, onClose }: DetailPanelProps) {
  if (!selected) return null
  return (
    <aside className={styles.panel}>
      <button type="button" className={styles.close} aria-label="Close details" onClick={onClose}>
        ✕
      </button>
      {selected.kind === "tool" && <ToolView connection={connection} id={selected.id} />}
      {selected.kind === "resource" && <ResourceView connection={connection} id={selected.id} key={selected.id} />}
      {selected.kind === "prompt" && <PromptView connection={connection} id={selected.id} />}
    </aside>
  )
}
