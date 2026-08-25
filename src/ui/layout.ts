export type EntityKind = "tool" | "resource" | "prompt"

export interface Hub { kind: EntityKind; label: string; count: number; x: number; y: number }
export interface LeafNode { kind: EntityKind; id: string; label: string; x: number; y: number }
export interface GraphLayout {
  server: { x: number; y: number }
  hubs: Hub[]
  leaves: LeafNode[]
  viewBox: { x: number; y: number; width: number; height: number }
}
export interface LayoutInput {
  tools: { name: string }[]
  resources: { uri: string; name?: string }[]
  prompts: { name: string }[]
}

// Deterministic polar layout (design decision #7 — no physics, identical every load):
// server at origin, one hub per category at a fixed angle, leaves fanned across a
// 120° arc behind each hub on concentric rings.
const HUB_ANGLE: Record<EntityKind, number> = { tool: -90, resource: 150, prompt: 30 }
const HUB_LABEL: Record<EntityKind, string> = { tool: "Tools", resource: "Resources", prompt: "Prompts" }
const HUB_RADIUS = 190
const RING_BASE = 120
const RING_STEP = 56
const RING_SPAN = 120
const PADDING = 90

const rad = (deg: number) => (deg * Math.PI) / 180
const ringCapacity = (ring: number) => 6 + ring * 3

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  return { x: cx + r * Math.cos(rad(angleDeg)), y: cy + r * Math.sin(rad(angleDeg)) }
}

export function computeLayout(input: LayoutInput): GraphLayout {
  const groups: { kind: EntityKind; items: { id: string; label: string }[] }[] = [
    { kind: "tool", items: input.tools.map((t) => ({ id: t.name, label: t.name })) },
    { kind: "resource", items: input.resources.map((r) => ({ id: r.uri, label: r.name ?? r.uri })) },
    { kind: "prompt", items: input.prompts.map((p) => ({ id: p.name, label: p.name })) },
  ]

  const hubs: Hub[] = []
  const leaves: LeafNode[] = []

  for (const group of groups) {
    const angle = HUB_ANGLE[group.kind]
    const hub = polar(0, 0, HUB_RADIUS, angle)
    hubs.push({ kind: group.kind, label: HUB_LABEL[group.kind], count: group.items.length, ...hub })

    let ring = 0
    let remaining = group.items
    while (remaining.length > 0) {
      const slice = remaining.slice(0, ringCapacity(ring))
      remaining = remaining.slice(slice.length)
      const r = RING_BASE + ring * RING_STEP
      const step = RING_SPAN / slice.length
      slice.forEach((item, i) => {
        const a = angle - RING_SPAN / 2 + step * (i + 0.5)
        const p = polar(hub.x, hub.y, r, a)
        leaves.push({ kind: group.kind, id: item.id, label: item.label, ...p })
      })
      ring++
    }
  }

  const xs = [0, ...hubs.map((h) => h.x), ...leaves.map((l) => l.x)]
  const ys = [0, ...hubs.map((h) => h.y), ...leaves.map((l) => l.y)]
  const minX = Math.min(...xs) - PADDING
  const minY = Math.min(...ys) - PADDING
  const maxX = Math.max(...xs) + PADDING
  const maxY = Math.max(...ys) + PADDING

  return {
    server: { x: 0, y: 0 },
    hubs,
    leaves,
    viewBox: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
  }
}
