import { useEffect, useRef, useState } from "react"
import { createKonamiDetector } from "./konami"
import HeighlinerScene from "./HeighlinerScene"

const STORAGE_KEY = "mcp-explore:dune-mode"
const TRANSITION_HOLD_MS = 4500

export default function DuneOverlay() {
  const [active, setActive] = useState(() => localStorage.getItem(STORAGE_KEY) === "true")
  const [transitioning, setTransitioning] = useState(false)
  const shipSeed = useRef(window.location.href)

  useEffect(() => {
    const handleKey = createKonamiDetector(() => {
      setActive((prev) => {
        const next = !prev
        localStorage.setItem(STORAGE_KEY, String(next))
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

  useEffect(() => {
    if (!active) return
    function onClick(e: MouseEvent) {
      const target = e.target as Element | null
      if (target?.closest("button") && !transitioning) {
        shipSeed.current = window.location.href
        setTransitioning(true)
      }
    }
    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, transitioning])

  useEffect(() => {
    if (!transitioning) return
    const id = window.setTimeout(() => setTransitioning(false), TRANSITION_HOLD_MS)
    return () => window.clearTimeout(id)
  }, [transitioning])

  if (!active) return null
  return <HeighlinerScene transitioning={transitioning} shipSeed={shipSeed.current} />
}
