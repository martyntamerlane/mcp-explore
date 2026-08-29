import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react"
import type { Connection } from "../../mcp/types"
import { formatCallResult, formatRunError, type RunDisplay } from "./runResult"

export type RunState = { status: "idle" } | { status: "running" } | { status: "done"; display: RunDisplay }

interface RunContextValue {
  runs: Record<string, RunState>
  run: (toolName: string, args?: Record<string, unknown>) => void
}

const RunContext = createContext<RunContextValue | null>(null)

// Run state lives beside the connection in App (not in the stage) so both the
// stage's tool buttons and the detail panel see the same per-tool state without
// widening the StageProps contract.
export function RunProvider({ connection, children }: { connection: Connection; children: ReactNode }) {
  const [runs, setRuns] = useState<Record<string, RunState>>({})
  // Ref, not state: firing the call from inside a state updater would double-run
  // it under StrictMode's double-invoked updaters.
  const inFlight = useRef(new Set<string>())

  const run = useCallback(
    (toolName: string, args?: Record<string, unknown>) => {
      if (inFlight.current.has(toolName)) return
      inFlight.current.add(toolName)
      setRuns((r) => ({ ...r, [toolName]: { status: "running" } }))
      const settle = (display: RunDisplay) => {
        inFlight.current.delete(toolName)
        setRuns((r) => ({ ...r, [toolName]: { status: "done", display } }))
      }
      connection.client
        .callTool({ name: toolName, arguments: args ?? {} })
        .then((result) => settle(formatCallResult(result)))
        .catch((error: unknown) => settle(formatRunError(error)))
    },
    [connection],
  )

  const value = useMemo(() => ({ runs, run }), [runs, run])
  return <RunContext.Provider value={value}>{children}</RunContext.Provider>
}

export function useRuns(): RunContextValue {
  const ctx = useContext(RunContext)
  if (!ctx) throw new Error("useRuns must be used inside a RunProvider")
  return ctx
}
