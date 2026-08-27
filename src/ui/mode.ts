/**
 * Light/dark mode (console-drawer + dark-mode spec §3): follows the system
 * until the user makes an explicit choice via the toggle, which persists.
 * Mechanically a data-mode attribute on the root; Dune wins regardless (the
 * dark token block carries a :not([data-theme="dune"]) guard).
 */
export type Mode = "light" | "dark"

const STORAGE_KEY = "mcp-explore:mode"
const QUERY = "(prefers-color-scheme: dark)"

export function storedMode(): Mode | null {
  const value = localStorage.getItem(STORAGE_KEY)
  return value === "light" || value === "dark" ? value : null
}

export function saveMode(mode: Mode): void {
  localStorage.setItem(STORAGE_KEY, mode)
}

export function systemMode(): Mode {
  if (typeof window.matchMedia !== "function") return "light"
  return window.matchMedia(QUERY).matches ? "dark" : "light"
}

export function initialMode(): Mode {
  return storedMode() ?? systemMode()
}

export function applyMode(mode: Mode): void {
  document.documentElement.dataset.mode = mode
}

/** Subscribe to system changes; returns an unsubscribe. Caller decides whether a stored choice mutes it. */
export function followSystem(onChange: (mode: Mode) => void): () => void {
  if (typeof window.matchMedia !== "function") return () => {}
  const mql = window.matchMedia(QUERY)
  const handler = (e: { matches: boolean }) => onChange(e.matches ? "dark" : "light")
  mql.addEventListener("change", handler)
  return () => mql.removeEventListener("change", handler)
}
