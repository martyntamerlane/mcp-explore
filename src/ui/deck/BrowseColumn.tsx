import { useMemo, useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import { buildBrowseTree, type BrowseFolder, type BrowseNode } from "./browseTree"
import { igniteContainer, igniteItem } from "./choreography"
import type { BrowseItem, DeckModel } from "./deckModel"
import type { EntityKind, EntitySelection } from "../stage"
import Glyph from "./Glyph"
import styles from "./BrowseColumn.module.css"

/**
 * The browse column (tool-first workspace spec §3.2): one list at a time behind
 * a segmented control, plus Home. Rows never unfold — selecting one opens it in
 * the workspace, so the column stays a narrow, scannable index at every size.
 */
export interface BrowseColumnProps {
  model: DeckModel
  query: string
  selection: EntitySelection | null
  onSelect: (selection: EntitySelection | null) => void
}

const SEGMENTS: EntityKind[] = ["tool", "resource", "prompt"]
const SEGMENT_LABEL: Record<EntityKind, string> = { tool: "Tools", resource: "Resources", prompt: "Prompts" }

const nodeKey = (n: BrowseNode) => (n.type === "folder" ? `folder:${n.path}` : `leaf:${n.item.id}`)

function anyMatch(node: BrowseNode, matches: (label: string) => boolean): boolean {
  return node.type === "leaf" ? matches(node.item.label) : node.children.some((c) => anyMatch(c, matches))
}

interface RowCtx {
  matches: (label: string) => boolean
  queryActive: boolean
  selection: EntitySelection | null
  onSelect: (selection: EntitySelection) => void
  openFolders: ReadonlySet<string>
  onToggleFolder: (path: string) => void
}

function LeafRow({ item, ctx }: { item: BrowseItem; ctx: RowCtx }) {
  const selected = ctx.selection?.kind === item.kind && ctx.selection.id === item.id
  return (
    <button
      type="button"
      className={styles.row}
      data-kind={item.kind}
      data-receded={!ctx.matches(item.label) || undefined}
      aria-label={`${item.kind} ${item.label}`}
      aria-current={selected ? "true" : undefined}
      onClick={() => ctx.onSelect({ kind: item.kind, id: item.id })}
    >
      <Glyph kind={item.kind} />
      <span className={styles.name}>{item.label}</span>
    </button>
  )
}

function FolderRow({ folder, ctx }: { folder: BrowseFolder; ctx: RowCtx }) {
  // An active filter forces folders open so nested matches are visible.
  const open = ctx.queryActive || ctx.openFolders.has(folder.path)
  const receded = ctx.queryActive && !folder.children.some((c) => anyMatch(c, ctx.matches))
  return (
    <div className={styles.folder} data-receded={receded || undefined}>
      <button
        type="button"
        className={`${styles.row} ${styles.folderRow}`}
        aria-label={`folder ${folder.name}`}
        aria-expanded={open}
        onClick={() => ctx.onToggleFolder(folder.path)}
      >
        <span className={styles.chevron} data-open={open || undefined} aria-hidden="true">
          ▸
        </span>
        <span className={styles.name}>{folder.name}</span>
        <span className={styles.count}>{folder.count}</span>
      </button>
      {open && (
        <div className={styles.children}>
          {folder.children.map((n) => (
            <NodeRow key={nodeKey(n)} node={n} ctx={ctx} />
          ))}
        </div>
      )}
    </div>
  )
}

function NodeRow({ node, ctx }: { node: BrowseNode; ctx: RowCtx }) {
  return node.type === "folder" ? <FolderRow folder={node} ctx={ctx} /> : <LeafRow item={node.item} ctx={ctx} />
}

export default function BrowseColumn({ model, query, selection, onSelect }: BrowseColumnProps) {
  const [segment, setSegment] = useState<EntityKind>("tool")
  const [openFolders, setOpenFolders] = useState<ReadonlySet<string>>(new Set())
  // Power-on cascade, one shot per connect; reduced motion renders it instantly.
  const reduced = useReducedMotion()

  const q = query.trim().toLowerCase()
  const queryActive = q !== ""
  const matches = (label: string) => !queryActive || label.toLowerCase().includes(q)

  const resourceGroup = model.groups.find((g) => g.kind === "resource")
  const promptGroup = model.groups.find((g) => g.kind === "prompt")

  const resourceNodes = useMemo(() => buildBrowseTree(resourceGroup?.items ?? []), [resourceGroup])

  const counts: Record<EntityKind, number> = {
    tool: model.tools.length,
    resource: resourceGroup?.items.length ?? 0,
    prompt: promptGroup?.items.length ?? 0,
  }
  // While filtering, each segment advertises its own hits so a match hiding in
  // another list is visible rather than silently absent (spec §8).
  const hits: Record<EntityKind, number> = {
    tool: model.tools.filter((t) => matches(t.label)).length,
    resource: (resourceGroup?.items ?? []).filter((i) => matches(i.label)).length,
    prompt: (promptGroup?.items ?? []).filter((i) => matches(i.label)).length,
  }

  const ctx: RowCtx = {
    matches,
    queryActive,
    selection,
    onSelect,
    openFolders,
    onToggleFolder: (path) =>
      setOpenFolders((s) => {
        const next = new Set(s)
        if (next.has(path)) next.delete(path)
        else next.add(path)
        return next
      }),
  }

  return (
    <nav className={styles.column} aria-label="Browse server">
      <button
        type="button"
        className={styles.home}
        aria-label="Home"
        aria-current={selection === null ? "true" : undefined}
        onClick={() => onSelect(null)}
      >
        <span className={styles.homeGlyph} aria-hidden="true">
          ⌂
        </span>
        Home
      </button>

      <div className={styles.segments} role="group" aria-label="Kind">
        {SEGMENTS.map((kind) => (
          <button
            key={kind}
            type="button"
            className={styles.segment}
            aria-pressed={segment === kind}
            onClick={() => setSegment(kind)}
          >
            {SEGMENT_LABEL[kind]} <span className={styles.count}>{queryActive ? hits[kind] : counts[kind]}</span>
          </button>
        ))}
      </div>

      <motion.div
        className={styles.list}
        variants={igniteContainer(0.12)}
        initial={reduced ? false : "hidden"}
        animate="show"
      >
        {segment === "tool" &&
          (model.tools.length === 0 ? (
            <p className={styles.none}>This server exposes no tools.</p>
          ) : (
            model.tools.map((tool) => {
              const selected = selection?.kind === "tool" && selection.id === tool.id
              return (
                <motion.button
                  variants={reduced ? undefined : igniteItem}
                  key={tool.id}
                  type="button"
                  className={styles.row}
                  data-kind="tool"
                  data-receded={!matches(tool.label) || undefined}
                  aria-label={`tool ${tool.label}`}
                  aria-current={selected ? "true" : undefined}
                  onClick={() => onSelect({ kind: "tool", id: tool.id })}
                >
                  <Glyph kind="tool" />
                  <span className={styles.name}>{tool.label}</span>
                  {tool.readOnly && <span className={styles.badge}>read only</span>}
                </motion.button>
              )
            })
          ))}

        {segment === "resource" &&
          (resourceNodes.length === 0 ? (
            <p className={styles.none}>This server exposes no resources.</p>
          ) : (
            resourceNodes.map((n) => (
              <motion.div key={nodeKey(n)} variants={reduced ? undefined : igniteItem}>
                <NodeRow node={n} ctx={ctx} />
              </motion.div>
            ))
          ))}

        {segment === "prompt" &&
          ((promptGroup?.items.length ?? 0) === 0 ? (
            <p className={styles.none}>This server exposes no prompts.</p>
          ) : (
            (promptGroup?.items ?? []).map((item) => (
              <motion.div key={item.id} variants={reduced ? undefined : igniteItem}>
                <LeafRow item={item} ctx={ctx} />
              </motion.div>
            ))
          ))}
      </motion.div>
    </nav>
  )
}
