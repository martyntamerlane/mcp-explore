import type { BrowseItem } from "./deckModel"

/**
 * Folder tree derived from resource URIs (rail-browser spec §2, retained by the tool-first workspace spec §3.2). The tree is
 * earned, not imposed: a folder exists only when it groups >= 2 entries,
 * single-child folder chains collapse into one "a/b" segment, and a lone
 * shared scheme is invisible (mixed schemes become top-level folders).
 */
export interface BrowseFolder {
  type: "folder"
  name: string
  path: string
  children: BrowseNode[]
  count: number
}

export interface BrowseLeaf {
  type: "leaf"
  item: BrowseItem
}

export type BrowseNode = BrowseFolder | BrowseLeaf

const MIN_FOLDER_ENTRIES = 2

// URIs come from an untrusted server — parse with a strict pattern, never throw;
// anything unparseable is simply a flat leaf.
const SCHEME_RE = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/(.*)$/

function parseUri(uri: string): { scheme: string | null; folders: string[] } {
  const m = SCHEME_RE.exec(uri)
  if (!m) return { scheme: null, folders: [] }
  const segments = m[2].split("/").filter((s) => s !== "")
  return { scheme: m[1], folders: segments.slice(0, -1) }
}

interface Trie {
  folders: Map<string, Trie>
  leaves: OrderedLeaf[]
}

interface OrderedLeaf {
  item: BrowseItem
  order: number
}

const makeTrie = (): Trie => ({ folders: new Map(), leaves: [] })

const join = (path: string, name: string) => (path === "" ? name : `${path}/${name}`)

interface Emitted {
  folders: BrowseFolder[]
  leaves: OrderedLeaf[]
  count: number
}

function emit(node: Trie, path: string): Emitted {
  const folders: BrowseFolder[] = []
  const leaves: OrderedLeaf[] = [...node.leaves]
  let count = node.leaves.length

  for (const [name, child] of node.folders) {
    const sub = emit(child, join(path, name))
    count += sub.count
    if (sub.count < MIN_FOLDER_ENTRIES) {
      // Below the threshold nothing survives as a folder — hoist the leaf.
      leaves.push(...sub.leaves)
      continue
    }
    const collapsible = !name.endsWith("://") && sub.leaves.length === 0 && sub.folders.length === 1
    if (collapsible) {
      const only = sub.folders[0]
      folders.push({ ...only, name: `${name}/${only.name}` })
    } else {
      folders.push({
        type: "folder",
        name,
        path: join(path, name),
        children: [...sub.folders, ...sub.leaves.sort((a, b) => a.order - b.order).map(toLeaf)],
        count: sub.count,
      })
    }
  }

  leaves.sort((a, b) => a.order - b.order)
  return { folders, leaves, count }
}

const toLeaf = (l: OrderedLeaf): BrowseLeaf => ({ type: "leaf", item: l.item })

export function buildBrowseTree(items: BrowseItem[]): BrowseNode[] {
  const parsed = items.map((item) => ({ item, ...parseUri(item.id) }))
  const schemes = new Set(parsed.filter((p) => p.scheme !== null).map((p) => p.scheme))
  const multiScheme = schemes.size > 1

  const root = makeTrie()
  parsed.forEach(({ item, scheme, folders }, order) => {
    const path = multiScheme && scheme !== null ? [`${scheme}://`, ...folders] : folders
    let node = root
    for (const segment of path) {
      let next = node.folders.get(segment)
      if (!next) node.folders.set(segment, (next = makeTrie()))
      node = next
    }
    node.leaves.push({ item, order })
  })

  const top = emit(root, "")
  return [...top.folders, ...top.leaves.map(toLeaf)]
}
