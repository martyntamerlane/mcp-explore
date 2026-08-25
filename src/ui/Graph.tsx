import { useRef, useState } from "react"
import type { EntityKind, GraphLayout, LeafNode } from "./layout"
import styles from "./Graph.module.css"

export interface GraphSelection { kind: EntityKind; id: string }
export interface GraphProps {
  layout: GraphLayout
  serverName: string
  selected: GraphSelection | null
  onSelect: (sel: GraphSelection | null) => void
}

const FILL: Record<EntityKind, string> = {
  tool: "var(--tool)",
  resource: "var(--resource)",
  prompt: "var(--prompt)",
}
const BRIGHT: Record<EntityKind, string> = {
  tool: "var(--tool-bright)",
  resource: "var(--resource-bright)",
  prompt: "var(--prompt-bright)",
}

function LeafShape({ node, bright }: { node: LeafNode; bright: boolean }) {
  const fill = FILL[node.kind]
  const stroke = bright ? BRIGHT[node.kind] : "none"
  switch (node.kind) {
    case "tool":
      return <circle r={9} fill={fill} stroke={stroke} strokeWidth={2} />
    case "resource":
      return <rect x={-8} y={-8} width={16} height={16} rx={4} fill={fill} stroke={stroke} strokeWidth={2} />
    case "prompt":
      return (
        <rect x={-8} y={-8} width={16} height={16} rx={3} transform="rotate(45)" fill={fill} stroke={stroke} strokeWidth={2} />
      )
  }
}

export default function Graph({ layout, serverName, selected, onSelect }: GraphProps) {
  const [query, setQuery] = useState("")
  const [view, setView] = useState({ k: 1, tx: 0, ty: 0 })
  const drag = useRef<{ x: number; y: number } | null>(null)

  const q = query.trim().toLowerCase()
  const dimmed = (n: LeafNode) => q !== "" && !n.label.toLowerCase().includes(q)
  const isSelected = (n: LeafNode) => selected !== null && selected.kind === n.kind && selected.id === n.id

  const zoom = (factor: number) =>
    setView((v) => ({ ...v, k: Math.min(3, Math.max(0.4, v.k * factor)) }))

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <input
          aria-label="Filter nodes"
          className={styles.search}
          placeholder="filter…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          spellCheck={false}
        />
        <div className={styles.zoomers}>
          <button type="button" aria-label="Zoom out" onClick={() => zoom(1 / 1.25)}>−</button>
          <button type="button" aria-label="Zoom in" onClick={() => zoom(1.25)}>+</button>
          <button type="button" aria-label="Reset view" onClick={() => setView({ k: 1, tx: 0, ty: 0 })}>⌂</button>
        </div>
      </div>
      <svg
        className={styles.svg}
        viewBox={`${layout.viewBox.x} ${layout.viewBox.y} ${layout.viewBox.width} ${layout.viewBox.height}`}
        onWheel={(e) => zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15)}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) drag.current = { x: e.clientX, y: e.clientY }
        }}
        onPointerMove={(e) => {
          if (drag.current) {
            const dx = e.clientX - drag.current.x
            const dy = e.clientY - drag.current.y
            drag.current = { x: e.clientX, y: e.clientY }
            setView((v) => ({ ...v, tx: v.tx + dx / v.k, ty: v.ty + dy / v.k }))
          }
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerLeave={() => (drag.current = null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) onSelect(null)
        }}
      >
        <defs>
          <filter id="nodeGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}>
          {layout.hubs.map((h) => (
            <line key={`edge-${h.kind}`} x1={0} y1={0} x2={h.x} y2={h.y} className={styles.edge} />
          ))}

          <g className={styles.server}>
            <circle r={26} className={styles.serverDot} />
            <text y={48} textAnchor="middle" className={styles.serverLabel}>
              {serverName}
            </text>
          </g>

          {layout.hubs.map((h) => (
            <g key={h.kind} transform={`translate(${h.x} ${h.y})`} className={styles.hub}>
              <circle r={4} fill={FILL[h.kind]} />
              <text y={-14} textAnchor="middle" className={styles.hubLabel}>
                {`${h.label.toUpperCase()} · ${h.count}`}
              </text>
            </g>
          ))}

          {layout.leaves.map((n) => (
            <g
              key={`${n.kind}:${n.id}`}
              transform={`translate(${n.x} ${n.y})`}
              role="button"
              tabIndex={0}
              aria-label={`${n.kind} ${n.label}`}
              className={[styles.leaf, dimmed(n) ? styles.dimmed : "", isSelected(n) ? styles.selected : ""].join(" ").trim()}
              filter={isSelected(n) ? "url(#nodeGlow)" : undefined}
              onClick={() => onSelect({ kind: n.kind, id: n.id })}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  onSelect({ kind: n.kind, id: n.id })
                }
              }}
            >
              <circle r={18} className={styles.halo} />
              <LeafShape node={n} bright={isSelected(n)} />
              <text y={30} textAnchor="middle" className={styles.leafLabel}>
                {n.label}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  )
}
