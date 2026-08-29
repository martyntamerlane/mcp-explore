import type { ServerSnapshot } from "../mcp/types"
import type { EntityKind, EntitySelection } from "./stage"

/**
 * Selection in the address bar (interaction roadmap S1 / TODO-25).
 *
 * One parameter names the kind — `?server=…&tool=NAME`, `&resource=URI`,
 * `&prompt=NAME` — so a link is self-describing and a stray combination is
 * ignorable rather than ambiguous. Everything here is pure: `App` owns the
 * History calls, this module owns what the strings mean.
 *
 * Values are percent-encoded by hand rather than through `URLSearchParams`,
 * which would render spaces as `+` and escape the slashes in a server URL —
 * the `?server=` form predates this module and links already in the wild use it.
 */
const KINDS: readonly EntityKind[] = ["tool", "resource", "prompt"]

/**
 * A selection from a query string, or null. Null covers every unusable case:
 * no kind parameter, an empty one, and — deliberately — more than one, since a
 * link naming both a tool and a resource has no honest reading.
 */
export function parseSelection(search: string): EntitySelection | null {
  const params = new URLSearchParams(search)
  const present = KINDS.filter((kind) => (params.get(kind) ?? "") !== "")
  if (present.length !== 1) return null
  const kind = present[0]
  return { kind, id: params.get(kind) as string }
}

/** The canonical query string for a server and a selection. Empty when neither exists. */
export function selectionSearch(server: string | undefined, selection: EntitySelection | null): string {
  const parts: string[] = []
  if (server) parts.push("server=" + encodeURIComponent(server))
  if (selection) parts.push(selection.kind + "=" + encodeURIComponent(selection.id))
  return parts.length === 0 ? "" : "?" + parts.join("&")
}

/**
 * A link can name anything; a server exposes what it exposes. A selection that
 * the snapshot does not contain resolves to home rather than to the workspace's
 * "no longer present" notice, because a stale share should open the server, not
 * an error about a name the visitor never typed.
 */
export function resolveSelection(
  selection: EntitySelection | null,
  snapshot: ServerSnapshot,
): EntitySelection | null {
  if (selection === null) return null
  const exists =
    selection.kind === "tool"
      ? snapshot.tools.some((t) => t.name === selection.id)
      : selection.kind === "resource"
        ? snapshot.resources.some((r) => r.uri === selection.id)
        : snapshot.prompts.some((p) => p.name === selection.id)
  return exists ? selection : null
}

export const sameSelection = (a: EntitySelection | null, b: EntitySelection | null): boolean =>
  a === b || (a !== null && b !== null && a.kind === b.kind && a.id === b.id)
