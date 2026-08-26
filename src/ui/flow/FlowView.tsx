import { useMemo, useRef, useState, type CSSProperties } from "react"
import type { EntityKind, StageProps } from "../stage"
import { buildFlowModel, type FlowGroup, type FlowItem } from "./flowModel"
import TraceLayer from "./TraceLayer"
import styles from "./FlowView.module.css"

const FILL: Record<EntityKind, string> = {
  tool: "var(--tool)",
  resource: "var(--resource)",
  prompt: "var(--prompt)",
}

function Glyph({ kind }: { kind: EntityKind }) {
  const fill = FILL[kind]
  return (
    <svg className={styles.glyph} viewBox="-10 -10 20 20" aria-hidden="true">
      {kind === "tool" && <circle r={6} fill={fill} />}
      {kind === "resource" && <rect x={-5.5} y={-5.5} width={11} height={11} rx={3} fill={fill} />}
      {kind === "prompt" && <rect x={-5} y={-5} width={10} height={10} rx={2} transform="rotate(45)" fill={fill} />}
    </svg>
  )
}

function Pill({
  item,
  wide,
  receded,
  selected,
  onSelect,
  onHover,
}: {
  item: FlowItem
  wide: boolean
  receded: boolean
  selected: boolean
  onSelect: () => void
  onHover: (item: FlowItem | null) => void
}) {
  return (
    <button
      type="button"
      aria-label={`${item.kind} ${item.label}`}
      aria-pressed={selected}
      data-receded={receded || undefined}
      data-kind={item.kind}
      className={[styles.pill, wide ? styles.wide : styles.compact, selected ? styles.selectedPill : ""]
        .join(" ")
        .trim()}
      onClick={onSelect}
      onMouseEnter={() => onHover(item)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(item)}
      onBlur={() => onHover(null)}
    >
      <Glyph kind={item.kind} />
      <span className={styles.pillName}>{item.label}</span>
      {wide && item.blurb && <span className={styles.pillBlurb}>{item.blurb}</span>}
    </button>
  )
}

function Cluster({
  group,
  index,
  matches,
  selection,
  collapsed,
  onToggle,
  onSelect,
  onHover,
  nodeRef,
}: {
  group: FlowGroup
  index: number
  matches: (i: FlowItem) => boolean
  selection: StageProps["selection"]
  collapsed: boolean
  onToggle: () => void
  onSelect: StageProps["onSelect"]
  onHover: (item: FlowItem | null) => void
  nodeRef: (el: HTMLElement | null) => void
}) {
  return (
    <section ref={nodeRef} className={styles.cluster} style={{ "--i": index } as CSSProperties} data-kind={group.kind}>
      <header className={styles.clusterHeader}>
        <span className={styles.clusterTitle}>{`${group.label.toUpperCase()} · ${group.items.length}`}</span>
        {group.items.length > 0 && (
          <button
            type="button"
            className={styles.collapse}
            aria-label={`${collapsed ? "Expand" : "Collapse"} ${group.label}`}
            onClick={onToggle}
          >
            {collapsed ? "▸" : "▾"}
          </button>
        )}
      </header>
      <p className={styles.gloss}>{group.gloss}</p>
      {!collapsed && group.items.length > 0 && (
        <div className={group.density === "wide" ? styles.wideList : styles.compactList}>
          {group.items.map((item) => (
            <Pill
              key={`${item.kind}:${item.id}`}
              item={item}
              wide={group.density === "wide"}
              receded={!matches(item)}
              selected={selection?.kind === item.kind && selection?.id === item.id}
              onSelect={() => onSelect({ kind: item.kind, id: item.id })}
              onHover={onHover}
            />
          ))}
        </div>
      )}
      {group.items.length === 0 && <p className={styles.empty}>none</p>}
    </section>
  )
}

export default function FlowView({ snapshot, transportKind, selection, onSelect }: StageProps) {
  const model = useMemo(() => buildFlowModel(snapshot), [snapshot])
  const [query, setQuery] = useState("")
  const [hovered, setHovered] = useState<FlowItem | null>(null)
  const [collapsed, setCollapsed] = useState<Partial<Record<EntityKind, boolean>>>({})
  const diagramRef = useRef<HTMLDivElement | null>(null)
  const serverRef = useRef<HTMLDivElement | null>(null)
  const clusterRefs = useRef<Partial<Record<EntityKind, HTMLElement | null>>>({})

  const q = query.trim().toLowerCase()
  const matches = (i: FlowItem) => q === "" || i.label.toLowerCase().includes(q)

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <input
          aria-label="Filter items"
          className={styles.search}
          placeholder="filter…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          spellCheck={false}
        />
      </div>
      <div className={styles.scroll}>
        <div className={styles.diagram} ref={diagramRef}>
          <TraceLayer
            key={`${collapsed.tool ?? false}:${collapsed.resource ?? false}:${collapsed.prompt ?? false}`}
            containerRef={diagramRef}
            serverRef={serverRef}
            clusterRefs={clusterRefs}
          />
          <div className={styles.serverCol}>
            <div className={styles.serverNode} ref={serverRef}>
              <span className={styles.serverName}>{snapshot.serverInfo.name}</span>
              <span className={styles.serverMeta}>v{snapshot.serverInfo.version}</span>
              <span className={styles.serverMeta}>{transportKind}</span>
            </div>
          </div>
          <div className={styles.clusters}>
            {model.groups.map((g, i) => (
              <Cluster
                key={g.kind}
                group={g}
                index={i}
                matches={matches}
                selection={selection}
                collapsed={collapsed[g.kind] ?? false}
                onToggle={() => setCollapsed((c) => ({ ...c, [g.kind]: !c[g.kind] }))}
                onSelect={onSelect}
                onHover={setHovered}
                nodeRef={(el) => (clusterRefs.current[g.kind] = el)}
              />
            ))}
          </div>
        </div>
      </div>
      <div className={styles.readout} data-testid="readout" aria-live="polite">
        {hovered ? (
          <>
            <span className={styles.readoutName}>{hovered.label}</span>
            {hovered.blurb && <span className={styles.readoutBlurb}> — {hovered.blurb}</span>}
          </>
        ) : (
          <span className={styles.readoutIdle}>hover an item</span>
        )}
      </div>
    </div>
  )
}
