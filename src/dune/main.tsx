import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./theme.css"
import DuneOverlay, { STORAGE_KEY } from "./DuneOverlay"

// Apply the persisted theme synchronously, before the first paint — DuneOverlay's
// own useEffect that sets this attribute only runs after React's first render, so
// without this a returning dune-mode visitor would see one default-palette frame
// (with CinematicScene's dune-only custom properties resolving to nothing) before
// the effect catches up.
try {
  if (localStorage.getItem(STORAGE_KEY) === "true") {
    document.documentElement.dataset.theme = "dune"
  }
} catch {
  // Storage may be full, disabled, or blocked (e.g. private browsing). Falling
  // back to the default theme for this load is a fine degraded outcome.
}

const container = document.createElement("div")
container.id = "dune-root"
document.body.appendChild(container)

createRoot(container).render(
  <StrictMode>
    <DuneOverlay />
  </StrictMode>,
)
