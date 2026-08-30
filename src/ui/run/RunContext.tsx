import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react"
import type { Connection } from "../../mcp/types"
import {
  isRunning,
  progressRun,
  settleRun,
  startRun,
  viewRun,
  type RunProgress,
  type Runs,
} from "./runHistory"
import { formatCallResult, formatRunError } from "./runResult"

interface RunContextValue {
  runs: Runs
  run: (toolName: string, args?: Record<string, unknown>) => void
  /** Show a past run of this tool. */
  view: (toolName: string, id: number) => void
}

const RunContext = createContext<RunContextValue | null>(null)

/** The hard ceiling on one `tools/call`, however much progress a server reports. */
export const MAX_TOOL_CALL_MS = 10 * 60 * 1000

// Run state lives beside the connection in App (not in the stage) so both the
// stage's tool buttons and the workspace see the same per-tool state without
// widening the StageProps contract. Since 2026-08-29 it is a capped history per
// tool rather than a single result — see runHistory.ts for the state shape.
export function RunProvider({ connection, children }: { connection: Connection; children: ReactNode }) {
  const [runs, setRuns] = useState<Runs>({})
  // Refs, not state: firing the call from inside a state updater would double-run
  // it under StrictMode's double-invoked updaters.
  const inFlight = useRef(new Set<string>())
  const nextId = useRef(1)

  const run = useCallback(
    (toolName: string, args?: Record<string, unknown>) => {
      if (inFlight.current.has(toolName)) return
      inFlight.current.add(toolName)
      const id = nextId.current++
      const sent = args ?? {}
      setRuns((r) => startRun(r, toolName, id, sent, Date.now()))

      const settle = (display: ReturnType<typeof formatCallResult>) => {
        inFlight.current.delete(toolName)
        setRuns((r) => settleRun(r, toolName, id, display, Date.now()))
      }
      connection.client
        .callTool({ name: toolName, arguments: sent }, undefined, {
          // Most servers send nothing (verified against deepwiki and Hugging
          // Face on 2026-08-29); the elapsed-time counter is what carries the
          // common case. Wiring this costs nothing and is honest when a server
          // does report, and resetting the timeout on progress is the whole
          // point of a server bothering to send it.
          onprogress: (p: RunProgress) => setRuns((r) => progressRun(r, toolName, id, p)),
          resetTimeoutOnProgress: true,
          // The ceiling `resetTimeoutOnProgress` needs (ISSUE-15). On its own it
          // means a progress notification buys another full timeout, without
          // limit — an untrusted server that emits one periodically keeps the
          // call pending forever, and `inFlight` then refuses to run that tool
          // again for the rest of the session. Ten minutes is far beyond any
          // real tool and still terminates.
          maxTotalTimeout: MAX_TOOL_CALL_MS,
        })
        .then((result) => settle(formatCallResult(result)))
        .catch((error: unknown) => settle(formatRunError(error)))
    },
    [connection],
  )

  const view = useCallback((toolName: string, id: number) => {
    setRuns((r) => viewRun(r, toolName, id))
  }, [])

  const value = useMemo(() => ({ runs, run, view }), [runs, run, view])
  return <RunContext.Provider value={value}>{children}</RunContext.Provider>
}

export function useRuns(): RunContextValue {
  const ctx = useContext(RunContext)
  if (!ctx) throw new Error("useRuns must be used inside a RunProvider")
  return ctx
}

export { isRunning }
