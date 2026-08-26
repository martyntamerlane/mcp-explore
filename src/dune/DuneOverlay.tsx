import { useEffect, useRef, useState } from "react"
import { createKonamiDetector } from "./konami"
import HeighlinerScene from "./HeighlinerScene"

export const STORAGE_KEY = "mcp-explore:dune-mode"
const TRANSITION_HOLD_MS = 4500

// URL-scheme sniff, e.g. "https://foo.example/mcp" — deliberately generic so it
// isn't tied to MCP-specific URL shapes.
const URL_LIKE = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//

// The click trigger has no import/coupling into ConnectScreen's internals (see
// module-level isolation constraint in the dune-mode spec/plan) — this reads
// only generic DOM structure from the clicked button outward:
//   1. If the button lives inside a <form>, use that form's first text input's
//      value (this is the "Connect" submit button + URL field case).
//   2. Else if the button's own text content looks like a URL, use that (this is
//      a "recent server" reconnect button, whose label is the URL itself).
//   3. Otherwise fall back to the page URL (e.g. "Try the demo", "Add headers",
//      which have no URL of their own).
function deriveShipSeed(button: Element): string {
  const form = button.closest("form")
  if (form) {
    const input = form.querySelector("input")
    if (input instanceof HTMLInputElement && input.value.trim() !== "") {
      return input.value.trim()
    }
  }
  const text = button.textContent?.trim() ?? ""
  if (URL_LIKE.test(text)) {
    return text
  }
  return window.location.href
}

function readActiveFromStorage(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true"
  } catch {
    return false
  }
}

export default function DuneOverlay() {
  const [active, setActive] = useState(readActiveFromStorage)
  const [transitioning, setTransitioning] = useState(false)
  const shipSeed = useRef(window.location.href)
  const hasDeparted = useRef(false)

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
    // A fresh activation gets its own one-shot departure transition.
    hasDeparted.current = false
  }, [active])

  useEffect(() => {
    if (!active) return
    function onClick(e: MouseEvent) {
      const target = e.target as Element | null
      const button = target?.closest("button")
      if (button && !transitioning && !hasDeparted.current) {
        shipSeed.current = deriveShipSeed(button)
        hasDeparted.current = true
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
