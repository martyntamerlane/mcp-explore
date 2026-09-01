import { useState, type RefObject } from "react"
import type { ServerSnapshot, TransportKind } from "../mcp/types"
import Prism from "./deck/Prism"
import { Keycap } from "./Keycap"
import HowItWorks from "./HowItWorks"
import ModeToggle from "./ModeToggle"
import styles from "./ChromeBar.module.css"

/**
 * The single chrome band (tool-first workspace spec §3.1). Replaces the old
 * pair of stacked headers: app brand and server identity share one band, and
 * the filter lives here because it acts on the browse column below it.
 *
 * Server identity sits here rather than in the stage so the stage is purely
 * column + workspace; multi-server tiling (TODO-16) gives each tile its own bar.
 */
export interface ChromeBarProps {
  snapshot: ServerSnapshot
  transportKind: TransportKind
  query: string
  onQuery: (q: string) => void
  /** `/` focuses the filter from anywhere in the app (interaction roadmap S1). */
  filterRef?: RefObject<HTMLInputElement | null>
  onDisconnect: () => void
}

export default function ChromeBar({
  snapshot,
  transportKind,
  query,
  onQuery,
  filterRef,
  onDisconnect,
}: ChromeBarProps) {
  const [focused, setFocused] = useState(false)
  const commanding = query.startsWith(">")

  return (
    <header className={styles.bar}>
      <Prism className={styles.mark} />
      <span className={styles.wordmark}>MCP EXPLORE</span>
      <span className={styles.divider} aria-hidden="true" />
      <h1 className={styles.server}>{snapshot.serverInfo.name}</h1>
      <span className={styles.chip}>v{snapshot.serverInfo.version}</span>
      <span className={styles.chip}>{transportKind}</span>
      <div className={styles.actions}>
        {/* The filter's two jobs, taught by one keycap (interaction roadmap S2).
            At rest it advertises the key that reaches the box; with the caret
            inside it — where `/` would just type a slash — it advertises the
            character that turns the box into a command line instead. The cap is
            permanent furniture inside a control that was always here, which is
            the whole reason command mode is not an overlay. */}
        <div className={styles.filterWrap} data-commanding={commanding || undefined}>
          <input
            ref={filterRef}
            aria-label={commanding ? "Run a command" : "Filter items"}
            aria-keyshortcuts="/"
            data-filter=""
            className={styles.filter}
            placeholder={commanding ? "command…" : "filter…"}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            spellCheck={false}
          />
          {!commanding && (
            <span className={styles.filterCap}>
              <Keycap strong={focused}>{focused ? ">" : "/"}</Keycap>
            </span>
          )}
        </div>
        <HowItWorks />
        <ModeToggle />
        <button type="button" className={styles.disconnect} onClick={onDisconnect}>
          Disconnect
        </button>
      </div>
    </header>
  )
}
