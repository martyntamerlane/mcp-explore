import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react"
import type { Connection } from "../../mcp/types"
import { formatPromptMessages, formatReadError, formatResourceContents, type ReadDisplay } from "./readResult"

export type ReadState = { status: "loading" } | { status: "done"; display: ReadDisplay }

export type ReadKind = "resource" | "prompt"

export const readKey = (kind: ReadKind, id: string) => `${kind}:${id}`

interface ReadContextValue {
  reads: Record<string, ReadState>
  read: (kind: ReadKind, id: string, args?: Record<string, string>) => void
}

const ReadContext = createContext<ReadContextValue | null>(null)

// Selecting a resource or prompt triggers a read; results are cached for the
// session so returning to a subject is instant. Lives beside RunProvider in App —
// same pattern, same reason: state next to the connection, StageProps untouched.
export function ReadProvider({ connection, children }: { connection: Connection; children: ReactNode }) {
  const [reads, setReads] = useState<Record<string, ReadState>>({})
  // Ref, not state: starting the call inside a state updater would double-fire
  // under StrictMode's double-invoked updaters.
  const started = useRef(new Set<string>())

  const read = useCallback(
    (kind: ReadKind, id: string, args?: Record<string, string>) => {
      const key = readKey(kind, id)
      // The state key is the subject; the guard key includes the arguments, so
      // re-running a prompt with different values fetches again while a repeat
      // of the same request still hits the cache.
      const guard = args === undefined ? key : `${key}|${JSON.stringify(args)}`
      if (started.current.has(guard)) return
      started.current.add(guard)
      setReads((r) => ({ ...r, [key]: { status: "loading" } }))
      const settle = (display: ReadDisplay) => {
        setReads((r) => ({ ...r, [key]: { status: "done", display } }))
      }
      const call =
        kind === "resource"
          ? connection.client.readResource({ uri: id }).then(formatResourceContents)
          : connection.client.getPrompt({ name: id, arguments: args }).then(formatPromptMessages)
      call.then(settle).catch((error: unknown) => {
        // Transport errors are not cached — selecting the subject again retries.
        started.current.delete(guard)
        settle(formatReadError(error))
      })
    },
    [connection],
  )

  const value = useMemo(() => ({ reads, read }), [reads, read])
  return <ReadContext.Provider value={value}>{children}</ReadContext.Provider>
}

export function useReads(): ReadContextValue {
  const ctx = useContext(ReadContext)
  if (!ctx) throw new Error("useReads must be used inside a ReadProvider")
  return ctx
}
