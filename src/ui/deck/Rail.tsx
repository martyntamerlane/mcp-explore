import { useMemo, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { readKey, useReads } from "../run/ReadContext"
import type { ReadDisplay } from "../run/readResult"
import { MAX_RESULT_CHARS } from "../run/runResult"
import { igniteContainer, igniteItem } from "./choreography"
import type { RailGroup, RailItem } from "./deckModel"
import { buildRailTree, type RailFolder, type RailNode } from "./railTree"
import Glyph from "./Glyph"
import styles from "./DeckView.module.css"

export const RAIL_PREVIEW_MAX = 10

/**
 * The rail is a self-contained browser (rail-browser spec 2026-08-27): resources
 * render as a thresholded folder tree, rows unfold in place (accordion — one
 * open leaf per rail), and unfolding IS the load request. Rail rows never open
 * the detail panel and have no tooltips — the description lives in the fold.
 */
const leafKey = (item: RailItem) => `${item.kind}:${item.id}`
const nodeKey = (n: RailNode) => (n.type === "folder" ? `folder:${n.path}` : leafKey(n.item))

const zeroArgPrompt = (item: RailItem) => item.kind === "prompt" && (item.promptArgs ?? []).length === 0
const loadsOnUnfold = (item: RailItem) => item.kind === "resource" || zeroArgPrompt(item)

function anyMatch(node: RailNode, matches: (label: string) => boolean): boolean {
  return node.type === "leaf" ? matches(node.item.label) : node.children.some((c) => anyMatch(c, matches))
}

interface RowCtx {
  matches: (label: string) => boolean
  queryActive: boolean
  reduced: boolean
  openFolders: ReadonlySet<string>
  onToggleFolder: (path: string) => void
  openLeaf: string | null
  onToggleLeaf: (item: RailItem) => void
}

function ReadBlocks({ display }: { display: ReadDisplay }) {
  if (!display.ok) {
    return (
      <div role="alert" className={styles.readError}>
        {display.blocks.map((b, i) => (
          <pre key={i} className={styles.leafCode}>
            {b.text}
          </pre>
        ))}
      </div>
    )
  }
  return (
    <>
      {display.blocks.map((b, i) => (
        <div key={i} className={styles.readBlock}>
          {b.label && <p className={styles.microlabel}>{b.label.toUpperCase()}</p>}
          {b.text !== undefined && <pre className={styles.leafCode}>{b.text}</pre>}
          {b.image && <img className={styles.leafImg} src={b.image.src} alt={b.image.alt} />}
        </div>
      ))}
      {display.truncated && (
        <p className={styles.quietNote}>output capped at {MAX_RESULT_CHARS.toLocaleString("en-US")} characters</p>
      )}
    </>
  )
}

function LeafDetail({ item }: { item: RailItem }) {
  const { reads } = useReads()
  const state = loadsOnUnfold(item) ? reads[readKey(item.kind, item.id)] : undefined
  const args = item.promptArgs ?? []
  return (
    <div className={styles.leafDetail} aria-live="polite">
      {item.description && <p className={styles.leafDesc}>{item.description}</p>}
      {item.kind === "resource" && (
        <p className={styles.leafMeta}>
          <code>{item.id}</code>
          {item.mimeType && <span className={styles.leafMime}>{item.mimeType}</span>}
        </p>
      )}
      {item.kind === "prompt" && args.length > 0 && (
        <>
          <p className={styles.microlabel}>ARGUMENTS</p>
          <ul className={styles.leafArgs}>
            {args.map((a) => (
              <li key={a.name}>
                <code>{a.name}</code>
                {a.required && <span className={styles.req}> ✱</span>}
                {a.description && <span className={styles.leafArgDesc}> {a.description}</span>}
              </li>
            ))}
          </ul>
          <p className={styles.quietNote}>fill-in preview — coming with tool forms</p>
        </>
      )}
      {state?.status === "loading" && <p className={styles.quietNote}>Loading…</p>}
      {state?.status === "done" && <ReadBlocks display={state.display} />}
    </div>
  )
}

function LeafRow({ item, ctx }: { item: RailItem; ctx: RowCtx }) {
  const open = ctx.openLeaf === leafKey(item)
  return (
    <div className={styles.railEntry} data-receded={!ctx.matches(item.label) || undefined}>
      <button
        type="button"
        className={styles.railButton}
        data-leaf
        aria-label={`${item.kind} ${item.label}`}
        aria-expanded={open}
        onClick={() => ctx.onToggleLeaf(item)}
      >
        <Glyph kind={item.kind} />
        <span className={styles.railName}>{item.label}</span>
        <span className={styles.chevron} data-open={open || undefined} aria-hidden="true">
          ▸
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className={styles.leafFold}
            initial={ctx.reduced ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={ctx.reduced ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <LeafDetail item={item} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function FolderRow({ folder, ctx }: { folder: RailFolder; ctx: RowCtx }) {
  // An active filter forces folders open so nested matches are visible.
  const open = ctx.queryActive || ctx.openFolders.has(folder.path)
  const receded = ctx.queryActive && !folder.children.some((c) => anyMatch(c, ctx.matches))
  return (
    <div className={styles.railEntry} data-receded={receded || undefined}>
      <button
        type="button"
        className={`${styles.railButton} ${styles.folderButton}`}
        aria-label={`folder ${folder.name}`}
        aria-expanded={open}
        onClick={() => ctx.onToggleFolder(folder.path)}
      >
        <span className={styles.chevron} data-open={open || undefined} aria-hidden="true">
          ▸
        </span>
        <span className={styles.railName}>{folder.name}</span>
        <span className={styles.folderCount}>{folder.count}</span>
      </button>
      {open && (
        <div className={styles.railChildren}>
          {folder.children.map((n) => (
            <NodeRow key={nodeKey(n)} node={n} ctx={ctx} />
          ))}
        </div>
      )}
    </div>
  )
}

function NodeRow({ node, ctx }: { node: RailNode; ctx: RowCtx }) {
  return node.type === "folder" ? <FolderRow folder={node} ctx={ctx} /> : <LeafRow item={node.item} ctx={ctx} />
}

export default function Rail({
  groups,
  matches,
  queryActive,
  expanded,
  onToggleExpand,
  reduced,
}: {
  groups: RailGroup[]
  matches: (label: string) => boolean
  queryActive: boolean
  expanded: Partial<Record<"resource" | "prompt", boolean>>
  onToggleExpand: (kind: "resource" | "prompt") => void
  reduced: boolean
}) {
  const { read } = useReads()
  const [openLeaf, setOpenLeaf] = useState<string | null>(null)
  const [openFolders, setOpenFolders] = useState<ReadonlySet<string>>(new Set())

  const trees = useMemo(
    () =>
      groups.map((g) =>
        g.kind === "resource" ? buildRailTree(g.items) : g.items.map((item): RailNode => ({ type: "leaf", item })),
      ),
    [groups],
  )

  const ctx: RowCtx = {
    matches,
    queryActive,
    reduced,
    openFolders,
    onToggleFolder: (path) =>
      setOpenFolders((s) => {
        const next = new Set(s)
        if (next.has(path)) next.delete(path)
        else next.add(path)
        return next
      }),
    openLeaf,
    onToggleLeaf: (item) => {
      const key = leafKey(item)
      if (openLeaf === key) {
        setOpenLeaf(null)
        return
      }
      setOpenLeaf(key)
      // Unfold is the load request; reads are cached, so re-opening is instant.
      if (loadsOnUnfold(item)) read(item.kind, item.id)
    },
  }

  return (
    <div className={styles.rail}>
      {groups.map((group, gi) => {
        const nodes = trees[gi]
        const capped = !expanded[group.kind] && !queryActive && nodes.length > RAIL_PREVIEW_MAX
        const visible = capped ? nodes.slice(0, RAIL_PREVIEW_MAX) : nodes
        return (
          <motion.section
            key={group.kind}
            className={styles.railGroup}
            data-kind={group.kind}
            // the rail follows the grid in the power-on cascade
            variants={igniteContainer(0.55 + gi * 0.15)}
            initial={reduced ? false : "hidden"}
            animate="show"
          >
            <header className={styles.sectionHeader}>{`${group.label.toUpperCase()} · ${group.items.length}`}</header>
            <p className={styles.gloss}>{group.gloss}</p>
            {group.items.length === 0 && <p className={styles.empty}>none</p>}
            {visible.map((node) => (
              <motion.div key={nodeKey(node)} variants={reduced ? undefined : igniteItem}>
                <NodeRow node={node} ctx={ctx} />
              </motion.div>
            ))}
            {!queryActive && nodes.length > RAIL_PREVIEW_MAX && (
              <button
                type="button"
                className={styles.more}
                aria-label={capped ? `Show all ${nodes.length} ${group.label}` : `Show fewer ${group.label}`}
                onClick={() => onToggleExpand(group.kind)}
              >
                {capped ? `+ ${nodes.length - RAIL_PREVIEW_MAX} more` : "− show fewer"}
              </button>
            )}
          </motion.section>
        )
      })}
    </div>
  )
}
