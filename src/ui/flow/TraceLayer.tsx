import { useEffect, useState, type RefObject } from "react"
import type { EntityKind } from "../stage"
import styles from "./FlowView.module.css"

interface Trace {
  kind: EntityKind
  d: string
  x1: number
  y1: number
  x2: number
  y2: number
}

// Draws the server→cluster conduits by measuring the rendered DOM. Purely
// decorative (aria-hidden); renders nothing in environments without layout
// (jsdom returns zero-size rects), so tests never assert on it.
export default function TraceLayer({
  containerRef,
  serverRef,
  clusterRefs,
  emphasized,
}: {
  containerRef: RefObject<HTMLDivElement | null>
  serverRef: RefObject<HTMLDivElement | null>
  clusterRefs: RefObject<Partial<Record<EntityKind, HTMLElement | null>>>
  emphasized: EntityKind | null
}) {
  const [traces, setTraces] = useState<Trace[]>([])

  // A passive effect, deliberately not useLayoutEffect: this component renders
  // before its sibling/parent refs are attached (ref attachment and layout
  // effects share tree order), so a layout effect would see null refs and bail.
  useEffect(() => {
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
        next.push({
          kind: kind as EntityKind,
          d: `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`,
          x1,
          y1,
          x2,
          y2,
        })
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
      <defs>
        <filter id="traceGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        {traces.map((t) => (
          <linearGradient
            key={t.kind}
            id={`trace-grad-${t.kind}`}
            gradientUnits="userSpaceOnUse"
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
          >
            <stop offset="0" style={{ stopColor: "var(--ink)", stopOpacity: 0.06 }} />
            <stop offset="1" style={{ stopColor: `var(--${t.kind})`, stopOpacity: 0.65 }} />
          </linearGradient>
        ))}
      </defs>
      {traces.map((t) => (
        <g key={t.kind} data-emphasized={emphasized === t.kind || undefined}>
          <path
            className={styles.traceGlow}
            d={t.d}
            stroke={`var(--${t.kind})`}
            filter="url(#traceGlow)"
            pathLength={1}
          />
          <path className={styles.traceBase} d={t.d} stroke={`url(#trace-grad-${t.kind})`} pathLength={1} />
          <path className={styles.tracePulse} data-kind={t.kind} d={t.d} pathLength={1} />
        </g>
      ))}
    </svg>
  )
}
