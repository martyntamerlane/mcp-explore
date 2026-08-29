import type { EntityKind, EntitySelection } from "../stage"

/**
 * The browse column's key model (interaction roadmap S1 / TODO-26).
 *
 * Pure by design: flattening the visible list, moving a highlight through it,
 * and deciding what a keystroke means are all decidable without React, so all
 * three are tested as functions and `BrowseColumn` only wires them to events.
 *
 * The highlight is **not** the selection. ↑↓ move a highlight and ⏎ commits it,
 * VS Code style, rather than selecting as they move: on Hugging Face's 155
 * resources, selecting per keystroke would push 155 history entries and fire
 * 155 reads on the way to one — which would break the Back button that S1
 * exists to deliver.
 */

export interface NavItem {
  kind: EntityKind
  id: string
  label: string
}

export type NavNode =
  | { type: "leaf"; item: NavItem }
  | { type: "folder"; name: string; path: string; children: NavNode[]; count: number }

export type NavRow =
  | { type: "leaf"; key: string; selection: EntitySelection; receded: boolean }
  | { type: "folder"; key: string; path: string; open: boolean; receded: boolean }

export const leafKey = (kind: EntityKind, id: string) => `leaf:${kind}:${id}`
export const folderKey = (path: string) => `folder:${path}`

export function anyMatch(node: NavNode, matches: (label: string) => boolean): boolean {
  return node.type === "leaf" ? matches(node.item.label) : node.children.some((c) => anyMatch(c, matches))
}

export interface FlattenOptions {
  /** Whether a folder is expanded. An active filter forces every folder open. */
  isOpen: (path: string) => boolean
  matches: (label: string) => boolean
  queryActive: boolean
}

/**
 * The rows a keyboard can reach right now, in screen order — closed folders
 * hide their children from navigation exactly as they hide them from the eye.
 * Filtered-out rows stay in the list (they are still rendered, receded) but
 * carry `receded` so movement can skip them.
 */
export function flattenNav(nodes: NavNode[], opts: FlattenOptions): NavRow[] {
  const rows: NavRow[] = []
  const walk = (list: NavNode[]) => {
    for (const node of list) {
      if (node.type === "leaf") {
        rows.push({
          type: "leaf",
          key: leafKey(node.item.kind, node.item.id),
          selection: { kind: node.item.kind, id: node.item.id },
          receded: !opts.matches(node.item.label),
        })
        continue
      }
      const open = opts.queryActive || opts.isOpen(node.path)
      rows.push({
        type: "folder",
        key: folderKey(node.path),
        path: node.path,
        open,
        receded: opts.queryActive && !node.children.some((c) => anyMatch(c, opts.matches)),
      })
      if (open) walk(node.children)
    }
  }
  walk(nodes)
  return rows
}

/**
 * The next highlight key, clamped at both ends. Deliberately no wrapping: in a
 * 155-row list, wrapping from the last row to the first reads as a glitch, not
 * as a feature. An unknown or filtered-away key restarts from the near end.
 */
export function moveActive(rows: NavRow[], activeKey: string | null, delta: 1 | -1): string | null {
  const live = rows.filter((r) => !r.receded)
  if (live.length === 0) return null
  const at = live.findIndex((r) => r.key === activeKey)
  if (at === -1) return delta === 1 ? live[0].key : live[live.length - 1].key
  return live[Math.min(live.length - 1, Math.max(0, at + delta))].key
}

export type NavAction =
  | { type: "focusFilter" }
  | { type: "move"; delta: 1 | -1 }
  | { type: "commit" }
  | { type: "openFolder" }
  | { type: "closeFolder" }
  | { type: "clearFilter" }
  | { type: "home" }

export interface KeyContext {
  /** The keystroke landed in an input, textarea or contenteditable. */
  inTextField: boolean
  /** …and that field is the chrome band's filter, which drives this list. */
  inFilter: boolean
  /** A row button in this list has focus, so ⏎ is already a native click. */
  inListButton: boolean
  queryActive: boolean
}

export interface KeyEventLike {
  key: string
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
}

/**
 * What a keystroke means, or null for "leave it alone".
 *
 * The rule the whole table turns on: a tool's argument fields are text, and
 * nothing here may steal a keystroke from them. The filter is the exception —
 * it is this list's own control surface, so ↑↓⏎ act on the list while ←→ stay
 * with the text caret.
 */
export function keyAction(e: KeyEventLike, ctx: KeyContext): NavAction | null {
  if (e.altKey || e.ctrlKey || e.metaKey) return null
  // ↑↓⏎ reach the list from the filter and from anywhere that is not a field.
  const listKeys = !ctx.inTextField || ctx.inFilter
  switch (e.key) {
    case "/":
      return ctx.inTextField ? null : { type: "focusFilter" }
    case "ArrowDown":
      return listKeys ? { type: "move", delta: 1 } : null
    case "ArrowUp":
      return listKeys ? { type: "move", delta: -1 } : null
    case "Enter":
      // A focused row button already commits itself; two handlers would fight.
      return listKeys && !ctx.inListButton ? { type: "commit" } : null
    case "ArrowRight":
      return ctx.inTextField ? null : { type: "openFolder" }
    case "ArrowLeft":
      return ctx.inTextField ? null : { type: "closeFolder" }
    case "Escape":
      // Esc unwinds one layer at a time: the filter first, then the subject.
      return ctx.queryActive ? { type: "clearFilter" } : { type: "home" }
    default:
      return null
  }
}

/**
 * The folder paths on the way down to a leaf, or an empty list if it is not in
 * this tree. A deep link to a resource three folders deep must unfold them, or
 * the column shows nothing while the workspace shows the subject.
 */
export function foldersTo(nodes: NavNode[], key: string): string[] {
  const walk = (list: NavNode[], trail: string[]): string[] | null => {
    for (const node of list) {
      if (node.type === "leaf") {
        if (leafKey(node.item.kind, node.item.id) === key) return trail
        continue
      }
      const hit = walk(node.children, [...trail, node.path])
      if (hit !== null) return hit
    }
    return null
  }
  return walk(nodes, []) ?? []
}
