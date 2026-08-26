import type { ServerSnapshot } from "../../mcp/types"
import type { EntityKind } from "../stage"

/** Clusters with more items than this drop from wide (name + blurb) to compact (name-only) pills. */
export const WIDE_PILL_MAX = 8

export interface FlowItem {
  kind: EntityKind
  id: string
  label: string
  blurb?: string
}

export interface FlowGroup {
  kind: EntityKind
  label: string
  gloss: string
  density: "wide" | "compact"
  items: FlowItem[]
}

export interface FlowModel {
  groups: FlowGroup[]
}

const LABEL: Record<EntityKind, string> = { tool: "Tools", resource: "Resources", prompt: "Prompts" }
const GLOSS: Record<EntityKind, string> = {
  tool: "actions it can perform",
  resource: "data it exposes",
  prompt: "ready-made instructions",
}

function firstLine(text: string | undefined): string | undefined {
  const line = text?.split("\n").find((l) => l.trim() !== "")
  return line?.trim()
}

function group(kind: EntityKind, items: FlowItem[]): FlowGroup {
  return {
    kind,
    label: LABEL[kind],
    gloss: GLOSS[kind],
    density: items.length <= WIDE_PILL_MAX ? "wide" : "compact",
    items,
  }
}

export function buildFlowModel(snapshot: ServerSnapshot): FlowModel {
  return {
    groups: [
      group(
        "tool",
        snapshot.tools.map((t) => ({ kind: "tool", id: t.name, label: t.name, blurb: firstLine(t.description) })),
      ),
      group(
        "resource",
        snapshot.resources.map((r) => ({
          kind: "resource",
          id: r.uri,
          label: r.name,
          blurb: firstLine(r.description) ?? r.uri,
        })),
      ),
      group(
        "prompt",
        snapshot.prompts.map((p) => ({ kind: "prompt", id: p.name, label: p.name, blurb: firstLine(p.description) })),
      ),
    ],
  }
}
