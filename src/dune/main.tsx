import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./theme.css"
import DuneOverlay from "./DuneOverlay"

const container = document.createElement("div")
container.id = "dune-root"
document.body.appendChild(container)

createRoot(container).render(
  <StrictMode>
    <DuneOverlay />
  </StrictMode>,
)
