import { useLayoutEffect, useState, type RefObject } from "react"
import type { EntityKind } from "../stage"
import styles from "./FlowView.module.css"

interface Trace {
  kind: EntityKind
  d: string
}

// Draws the server→cluster traces by measuring the rendered DOM. Purely
// decorative (aria-hidden); renders nothing in environments without layout
// (jsdom returns zero-size rects), so tests never assert on it.
export default function TraceLayer({
  containerRef,
  serverRef,
  clusterRefs,
}: {
  containerRef: RefObject<HTMLDivElement | null>
  serverRef: RefObject<HTMLDivElement | null>
  clusterRefs: RefObject<Partial<Record<EntityKind, HTMLElement | null>>>
}) {
  const [traces, setTraces] = useState<Trace[]>([])

  useLayoutEffect(() => {
    const container = containerRef.current
    const server = serverRef.current
    if (!container || !server) return

    const compute = () => {
      const c = container.getBoundingClientRect()
      if (c.width === 0) return // jsdom / hidden
      const s = server.getBoundingClientRect()
      const x1 = s.right - c.left
      const y1 = s.top - c.top + s.height / 2
      const next: Trace[] = []
      for (const [kind, el] of Object.entries(clusterRefs.current ?? {})) {
        if (!el) continue
        const r = el.getBoundingClientRect()
        const x2 = r.left - c.left - 12
        const y2 = r.top - c.top + 14
        const mx = x1 + (x2 - x1) / 2
        next.push({ kind: kind as EntityKind, d: `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}` })
      }
      setTraces(next)
    }

    compute()
    if (typeof ResizeObserver === "undefined") return // jsdom
    const ro = new ResizeObserver(compute)
    ro.observe(container)
    return () => ro.disconnect()
  }, [containerRef, serverRef, clusterRefs])

  if (traces.length === 0) return null
  return (
    <svg className={styles.traces} data-testid="traces" aria-hidden="true">
      {traces.map((t) => (
        <g key={t.kind}>
          <path className={styles.traceBase} d={t.d} pathLength={1} />
          <path className={styles.tracePulse} d={t.d} pathLength={1} />
        </g>
      ))}
    </svg>
  )
}
