import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { MotionConfig } from "motion/react"
import "@fontsource-variable/space-grotesk"
import "@fontsource-variable/inter"
import "./global.css"
import App from "./App"
import { applyMode, initialMode } from "./ui/mode"

// Resolve light/dark before first paint so a dark-system visitor never sees a flash.
applyMode(initialMode())

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
)
