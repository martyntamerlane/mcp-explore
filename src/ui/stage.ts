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
  /** Set the filter text — Escape clears it from inside the stage (spec S1). */
  onQuery: (q: string) => void
  /** Put the caret in the chrome bar's filter; `/` reaches it from anywhere. */
  onFocusFilter: () => void
  /** Copy a link that reopens exactly this selection (command mode, spec S2). */
  onCopyLink: () => void
  /** Close the connection and return to the connect screen (command mode). */
  onDisconnect: () => void
}
