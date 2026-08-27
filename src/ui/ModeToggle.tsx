import { useEffect, useState } from "react"
import { applyMode, followSystem, initialMode, saveMode, storedMode, type Mode } from "./mode"
import styles from "./ModeToggle.module.css"

/**
 * Sun/moon toggle. Self-contained: reads the resolved mode, stamps the root
 * attribute, persists explicit choices, and follows live system changes only
 * while the user has never chosen. Mounted in the app header and on the landing
 * (never both at once).
 */
export default function ModeToggle() {
  const [mode, setMode] = useState<Mode>(initialMode)

  useEffect(() => applyMode(mode), [mode])

  useEffect(
    () =>
      followSystem((system) => {
        if (storedMode() === null) setMode(system)
      }),
    [],
  )

  const next: Mode = mode === "dark" ? "light" : "dark"
  return (
    <button
      type="button"
      className={styles.toggle}
      aria-label={`Switch to ${next} mode`}
      onClick={() => {
        saveMode(next)
        setMode(next)
      }}
    >
      <span aria-hidden="true">{mode === "dark" ? "☀" : "☾"}</span>
    </button>
  )
}
