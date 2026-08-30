import styles from "./Keycap.module.css"

/**
 * A key, drawn (interaction roadmap S2 / TODO-26).
 *
 * Shortcut legibility is half of S2's goal: before it, `/` existed only as an
 * `aria-keyshortcuts` attribute, which is to say it was documented to screen
 * readers and to nobody else. A keycap is how a shortcut becomes visible
 * without a manual.
 *
 * Flat by approval: hairline border, no fill, no depth. See the module CSS for
 * why shape rather than depth carries it here.
 */
export function Keycap({ children, strong }: { children: string; strong?: boolean }) {
  // aria-hidden throughout: these caps annotate controls that already carry
  // aria-keyshortcuts, and a screen reader announcing "slash" beside "Filter
  // items, keyboard shortcut slash" says the same thing twice.
  return (
    <kbd className={styles.cap} data-strong={strong || undefined} aria-hidden="true">
      {children}
    </kbd>
  )
}

/**
 * A run of caps and their meanings. Lives inside furniture that is already on
 * screen — never as a bar that arrives — so it teaches the keys exactly while
 * they are live and takes nothing with it when it goes.
 */
export function KeyLegend({ pairs }: { pairs: { keys: string[]; means: string }[] }) {
  return (
    <div className={styles.legend}>
      {pairs.map((pair) => (
        <span key={pair.means} className={styles.pair}>
          {pair.keys.map((k) => (
            <Keycap key={k}>{k}</Keycap>
          ))}
          {pair.means}
        </span>
      ))}
    </div>
  )
}
