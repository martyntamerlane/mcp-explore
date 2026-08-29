import type { RefObject } from "react"
import type { ServerSnapshot, TransportKind } from "../mcp/types"
import Prism from "./deck/Prism"
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
  return (
    <header className={styles.bar}>
      <Prism className={styles.mark} />
      <span className={styles.wordmark}>MCP EXPLORE</span>
      <span className={styles.divider} aria-hidden="true" />
      <h1 className={styles.server}>{snapshot.serverInfo.name}</h1>
      <span className={styles.chip}>v{snapshot.serverInfo.version}</span>
      <span className={styles.chip}>{transportKind}</span>
      <div className={styles.actions}>
        <input
          ref={filterRef}
          aria-label="Filter items"
          aria-keyshortcuts="/"
          data-filter=""
          className={styles.filter}
          placeholder="filter…"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          spellCheck={false}
        />
        <ModeToggle />
        <button type="button" className={styles.disconnect} onClick={onDisconnect}>
          Disconnect
        </button>
      </div>
    </header>
  )
}
