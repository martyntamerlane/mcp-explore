import type { ServerSnapshot } from "../mcp/types"
import type { EntityKind, EntitySelection } from "./stage"

/**
 * Selection in the address bar (interaction roadmap S1 / TODO-25).
 *
 * One parameter names the kind — `#server=…&tool=NAME`, `&resource=URI`,
 * `&prompt=NAME` — so a link is self-describing and a stray combination is
 * ignorable rather than ambiguous. Everything here is pure: `App` owns the
 * History calls, this module owns what the strings mean.
 *
 * **The fragment, not the query (TODO-31).** A query string is sent to the host
 * in the request for the document itself, so every shared `?server=` link and
 * every reload handed the address of someone's MCP server to GitHub Pages. A
 * fragment is never transmitted and never appears in a `Referer`. The app writes
 * `#` and reads either, because links already shared use `?` and must keep
 * working.
 *
 * Values are percent-encoded by hand rather than through `URLSearchParams`,
 * which would render spaces as `+` and escape the slashes in a server URL —
 * the `?server=` form predates this module and links already in the wild use it.
 */
const KINDS: readonly EntityKind[] = ["tool", "resource", "prompt"]

/** Every parameter this module understands. A string carrying none is not ours. */
const KEYS: readonly string[] = ["server", ...KINDS]

/**
 * Which half of the address bar the selection is in, as bare parameters.
 *
 * The fragment wins whenever it names anything of ours, and a demo-server
 * selection (`#tool=NAME`, no server) counts — so the test is "any of our keys
 * with a value", not "has a server".
 *
 * Requiring a *value* is what keeps the result outline out of this: its links
 * are heading slugs (`Outline.tsx`), and `#server` as a bare slug parses to a
 * `server` key with an empty value. `parseSelection` already treats an empty
 * parameter as absent; this is the same rule one level up.
 *
 * The sigil comes off here, and that is not cosmetic: `URLSearchParams` strips a
 * leading `?` but *not* a leading `#`, so handing `#tool=t` onward would parse a
 * key literally named `#tool` and read as home. Returning bare parameters makes
 * the output of this the input of `parseSelection`, symmetric with what
 * `selectionParams` produces.
 */
export function readParams(location: { search: string; hash: string }): string {
  const strip = (s: string) => s.replace(/^[#?]/, "")
  const hash = strip(location.hash)
  const params = new URLSearchParams(hash)
  return KEYS.some((key) => (params.get(key) ?? "") !== "") ? hash : strip(location.search)
}

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

/**
 * The canonical parameters for a server and a selection, with no leading sigil —
 * the caller decides whether they become a fragment or a query. Empty when
 * neither exists, which is how the caller knows to write a bare path.
 */
export function selectionParams(server: string | undefined, selection: EntitySelection | null): string {
  const parts: string[] = []
  if (server) parts.push("server=" + encodeURIComponent(server))
  if (selection) parts.push(selection.kind + "=" + encodeURIComponent(selection.id))
  return parts.join("&")
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
