import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"

/**
 * Whether the workspace is showing rendered markdown or the exact bytes behind
 * it — as something command mode can reach (interaction roadmap S2).
 *
 * Until now "Show raw" was local state inside each `TextBlock`, which was right
 * while the per-block button was the only way to flip it. A command has to act
 * on the whole result at once, so the value lives here — but the per-block
 * button must keep working, and it must keep meaning *this block*.
 *
 * The reconciliation is an epoch. The shared value carries a counter that ticks
 * every time a command sets it; a block that has been clicked remembers the
 * epoch it was clicked in, and its override expires the moment a command speaks
 * for everything. So: click one block, only that block flips; run the command,
 * every block agrees again.
 */
interface RawViewState {
  raw: boolean
  epoch: number
  /** How many blocks on screen are rendered markdown, i.e. have raw bytes to show. */
  renderable: number
  /** Called by each markdown block while it is mounted; returns its own removal. */
  register: () => () => void
  setAll: (raw: boolean) => void
}

// The inert default is deliberate rather than a thrown error: outside a provider
// there is no second owner to desync from — a lone block simply keeps its own
// override, which is exactly what it did before this file existed.
const RawViewCtx = createContext<RawViewState>({
  raw: false,
  epoch: 0,
  renderable: 0,
  register: () => () => {},
  setAll: () => {},
})

export function RawViewProvider({ children }: { children: ReactNode }) {
  const [raw, setRaw] = useState(false)
  const [epoch, setEpoch] = useState(0)
  const [renderable, setRenderable] = useState(0)

  const register = useCallback(() => {
    setRenderable((n) => n + 1)
    return () => setRenderable((n) => n - 1)
  }, [])

  const setAll = useCallback((next: boolean) => {
    setRaw(next)
    setEpoch((e) => e + 1)
  }, [])

  const value = useMemo(
    () => ({ raw, epoch, renderable, register, setAll }),
    [raw, epoch, renderable, register, setAll],
  )
  return <RawViewCtx.Provider value={value}>{children}</RawViewCtx.Provider>
}

export const useRawView = (): RawViewState => useContext(RawViewCtx)
