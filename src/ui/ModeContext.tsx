import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { applyMode, followSystem, initialMode, saveMode, storedMode, type Mode } from "./mode"

/**
 * One owner for light/dark (console-drawer + dark-mode spec §3).
 *
 * The mode used to live inside `ModeToggle` as local state, which was fine while
 * the toggle was the only way to change it. Command mode is a second route
 * (interaction roadmap S2), and two independent owners would desync: the command
 * would stamp the root attribute while the toggle went on rendering the glyph
 * and the aria-label of the mode it thought was current.
 *
 * The provider wraps the whole app, so the toggle on the landing and the toggle
 * in the chrome band — never both at once — read the same value.
 */
interface ModeState {
  mode: Mode
  setMode: (mode: Mode) => void
  toggle: () => void
}

const ModeCtx = createContext<ModeState | null>(null)

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>(initialMode)

  useEffect(() => applyMode(mode), [mode])

  // Follow live system changes only while the user has never chosen.
  useEffect(
    () =>
      followSystem((system) => {
        if (storedMode() === null) setModeState(system)
      }),
    [],
  )

  const setMode = (next: Mode) => {
    saveMode(next)
    setModeState(next)
  }

  return (
    <ModeCtx.Provider
      value={{
        mode,
        setMode,
        toggle: () => setMode(mode === "dark" ? "light" : "dark"),
      }}
    >
      {children}
    </ModeCtx.Provider>
  )
}

/**
 * The current mode. Throws outside a provider rather than falling back to a
 * private copy — a second, silent owner of the theme is the exact bug this file
 * exists to prevent, so it should fail loudly in a test rather than quietly in
 * the app.
 */
export function useMode(): ModeState {
  const ctx = useContext(ModeCtx)
  if (ctx !== null) return ctx
  throw new Error("useMode must be used inside a ModeProvider")
}
