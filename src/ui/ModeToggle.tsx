import { useMode } from "./ModeContext"
import styles from "./ModeToggle.module.css"

/**
 * Sun/moon toggle. Mounted in the app header and on the landing (never both at
 * once). The mode itself lives in `ModeContext` rather than here, because
 * command mode can change it too (interaction roadmap S2) and two owners of one
 * setting desync.
 */
export default function ModeToggle() {
  const { mode, toggle } = useMode()
  const next = mode === "dark" ? "light" : "dark"
  return (
    <button type="button" className={styles.toggle} aria-label={`Switch to ${next} mode`} onClick={toggle}>
      <span aria-hidden="true">{mode === "dark" ? "☀" : "☾"}</span>
    </button>
  )
}
