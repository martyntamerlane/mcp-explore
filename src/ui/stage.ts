import type { ServerSnapshot, TransportKind } from "../mcp/types"

export type EntityKind = "tool" | "resource" | "prompt"

export interface EntitySelection {
  kind: EntityKind
  id: string
}

// The stage contract (introduced by the flow-view spec, retained by the
// luminous-deck redesign): every display variant — the default deck, themed
// scenes — is a component taking exactly these props. App owns connection,
// selection, the filter query, and shared chrome (tool-first workspace spec §3.1).
export interface StageProps {
  snapshot: ServerSnapshot
  transportKind: TransportKind
  selection: EntitySelection | null
  onSelect: (selection: EntitySelection | null) => void
  /** The chrome bar's filter text; the stage decides what it narrows. */
  query: string
}
