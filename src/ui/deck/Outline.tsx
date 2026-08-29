import { useEffect, useRef, useState } from "react"
import type { HeadingRef } from "../markdown/parse"
import styles from "./Outline.module.css"

/**
 * A sticky outline in the workspace's right margin (interaction roadmap S4 /
 * TODO-29): a 50,000-character wiki page becomes navigable, and the margin the
 * reading pass deliberately created stops reading as empty.
 *
 * Permanent furniture while the result has one, absent when it does not — never
 * a surface that arrives. Below ~1180px the margin does not exist and the
 * outline is simply not there; there is no substitute affordance, because the
 * page still scrolls and inventing a mobile drawer would contradict the whole
 * visual system.
 */
export default function Outline({ entries }: { entries: HeadingRef[] }) {
  const ref = useRef<HTMLElement>(null)
  const [active, setActive] = useState<string | null>(null)
  // Ids actually in the document. A block toggled to "Show raw" renders no
  // headings, and an outline of links to nothing is worse than no outline.
  // null means "not measured yet" — distinct from "measured, found none".
  const [present, setPresent] = useState<readonly string[] | null>(null)

  useEffect(() => {
    const scroller = ref.current?.closest<HTMLElement>("[data-scroller]") ?? null
    if (scroller === null) return

    let frame = 0
    const measure = () => {
      frame = 0
      // Ids are unique in the document, so getElementById needs no escaping —
      // which matters, because slugs are derived from untrusted headings.
      const line = scroller.getBoundingClientRect().top + 12
      const found: string[] = []
      let current: string | null = null
      for (const entry of entries) {
        const el = document.getElementById(entry.id)
        if (el === null || !scroller.contains(el)) continue
        found.push(entry.id)
        if (el.getBoundingClientRect().top <= line) current = entry.id
      }
      setPresent((prev) =>
        prev !== null && prev.length === found.length && prev.every((id, i) => id === found[i]) ? prev : found,
      )
      setActive(current ?? found[0] ?? null)
    }
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(measure)
    }

    measure()
    scroller.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule)
    // Content can change height without a scroll — "Show raw" is the case that
    // matters — and that is what tells us which headings still exist.
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule)
    observer?.observe(scroller)
    for (const child of Array.from(scroller.children)) observer?.observe(child)

    return () => {
      if (frame !== 0) cancelAnimationFrame(frame)
      scroller.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
      observer?.disconnect()
    }
  }, [entries])

  const shown = present === null ? entries : entries.filter((e) => present.includes(e.id))
  // The element stays mounted even with nothing to show: it is what the effect
  // measures from, and returning null here would leave the ref forever empty —
  // the outline would then never appear at all.
  const topLevel = shown.length === 0 ? 0 : Math.min(...shown.map((e) => e.level))

  return (
    <nav
      className={styles.outline}
      aria-label="Result outline"
      ref={ref}
      data-empty={shown.length === 0 || undefined}
    >
      <p className={styles.label}>ON THIS PAGE</p>
      <ul className={styles.list}>
        {shown.map((entry) => (
          <li key={entry.id}>
            <a
              className={styles.link}
              href={`#${entry.id}`}
              data-depth={Math.min(2, entry.level - topLevel)}
              aria-current={entry.id === active ? "true" : undefined}
              onClick={(e) => {
                // Own the jump: a bare hash would also push a history entry,
                // and history belongs to selection here (S1).
                e.preventDefault()
                document.getElementById(entry.id)?.scrollIntoView({ block: "start", behavior: "smooth" })
              }}
            >
              {entry.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
