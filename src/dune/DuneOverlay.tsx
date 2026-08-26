import { useEffect, useState } from "react"
import { createKonamiDetector } from "./konami"
import CinematicScene from "./CinematicScene"

export const STORAGE_KEY = "mcp-explore:dune-mode"

function readActiveFromStorage(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true"
  } catch {
    return false
  }
}

export default function DuneOverlay() {
  const [active, setActive] = useState(readActiveFromStorage)

  useEffect(() => {
    const handleKey = createKonamiDetector(() => {
      setActive((prev) => {
        const next = !prev
        try {
          localStorage.setItem(STORAGE_KEY, String(next))
        } catch {
          // Storage may be full, disabled, or blocked (e.g. private browsing). The
          // toggle still applies for this session; it just won't persist.
        }
        return next
      })
    })
    const onKeyDown = (e: KeyboardEvent) => handleKey(e.key)
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    if (active) {
      document.documentElement.dataset.theme = "dune"
    } else {
      delete document.documentElement.dataset.theme
    }
  }, [active])

  if (!active) return null
  return <CinematicScene />
}
