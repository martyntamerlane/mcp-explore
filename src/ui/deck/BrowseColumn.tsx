import { useEffect, useMemo, useRef, useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import { buildBrowseTree, type BrowseFolder, type BrowseNode } from "./browseTree"
import { igniteContainer, igniteItem } from "./choreography"
import type { BrowseItem, DeckModel } from "./deckModel"
import {
  anyMatch,
  flattenNav,
  folderKey,
  foldersTo,
  keyAction,
  leafKey,
  moveActive,
  type NavNode,
  type NavRow,
} from "./keynav"
import { commandKey, isCommandQuery, commandQuery, matchCommands, type Command } from "./commands"
import type { EntityKind, EntitySelection } from "../stage"
import { KeyLegend } from "../Keycap"
import Glyph from "./Glyph"
import styles from "./BrowseColumn.module.css"

/**
 * The browse column (tool-first workspace spec §3.2): one list at a time behind
 * a segmented control, plus Home. Rows never unfold — selecting one opens it in
 * the workspace, so the column stays a narrow, scannable index at every size.
 *
 * It is also the app's keyboard surface (interaction roadmap S1): `/` reaches
 * the filter, ↑↓ move a highlight through the visible rows, ⏎ commits it, ←→
 * fold and unfold folders, Esc unwinds. The key model itself is pure and lives
 * in `keynav.ts`; this component only binds it to events and paints the result.
 *
 * And it is where command mode renders (interaction roadmap S2). While the
 * filter's text begins with `>`, this list shows commands instead of entities:
 * the furniture changes contents, nothing arrives over the top of it. The key
 * model is untouched by that — ↑↓ move, ⏎ commits, Esc unwinds — because the
 * rows moving through it only ever needed a key and a receded flag.
 */
export interface BrowseColumnProps {
  model: DeckModel
  query: string
  onQuery: (q: string) => void
  onFocusFilter: () => void
  selection: EntitySelection | null
  onSelect: (selection: EntitySelection | null) => void
  /** The commands that apply right now, already narrowed by context (S2). */
  commands: Command[]
  onRunCommand: (command: Command) => void
}

const SEGMENTS: EntityKind[] = ["tool", "resource", "prompt"]
const SEGMENT_LABEL: Record<EntityKind, string> = {
  tool: "Tools",
  resource: "Resources",
  prompt: "Prompts",
}

const nodeKey = (n: BrowseNode) => (n.type === "folder" ? folderKey(n.path) : leafKey(n.item.kind, n.item.id))

interface RowCtx {
  matches: (label: string) => boolean
  queryActive: boolean
  selection: EntitySelection | null
  activeKey: string | null
  onSelect: (selection: EntitySelection) => void
  openFolders: ReadonlySet<string>
  onToggleFolder: (path: string) => void
}

function LeafRow({ item, ctx }: { item: BrowseItem; ctx: RowCtx }) {
  const selected = ctx.selection?.kind === item.kind && ctx.selection.id === item.id
  const key = leafKey(item.kind, item.id)
  return (
    <button
      type="button"
      className={styles.row}
      data-kind={item.kind}
      data-navkey={key}
      data-active={ctx.activeKey === key || undefined}
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
  const key = folderKey(folder.path)
  return (
    <div className={styles.folder} data-receded={receded || undefined}>
      <button
        type="button"
        className={`${styles.row} ${styles.folderRow}`}
        data-navkey={key}
        data-active={ctx.activeKey === key || undefined}
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

export default function BrowseColumn({
  model,
  query,
  onQuery,
  onFocusFilter,
  selection,
  onSelect,
  commands,
  onRunCommand,
}: BrowseColumnProps) {
  // Tools first, except when the app opened on something else: a link to a
  // resource that landed on the Tools list would show its subject in the
  // workspace and nothing at all in the column. Only the initial value follows
  // the selection — clicking a tool from the Resources list must not yank the
  // list out from under the next click.
  const [segment, setSegment] = useState<EntityKind>(() => selection?.kind ?? "tool")
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  // Power-on cascade, one shot per connect; reduced motion renders it instantly.
  const reduced = useReducedMotion()

  // The filter has two jobs (interaction roadmap S2). While its text begins with
  // `>` it is a command line, so it is NOT narrowing the browse list — the rows
  // it would have receded are not even on screen. Escape still has to unwind it
  // first, which is why the key model is told the box is busy either way.
  const commanding = isCommandQuery(query)
  const q = commanding ? "" : query.trim().toLowerCase()
  const filterActive = q !== ""
  const queryActive = filterActive || commanding
  const matches = (label: string) => !filterActive || label.toLowerCase().includes(q)

  const resourceGroup = model.groups.find((g) => g.kind === "resource")
  const promptGroup = model.groups.find((g) => g.kind === "prompt")

  const resourceNodes = useMemo(() => buildBrowseTree(resourceGroup?.items ?? []), [resourceGroup])

  // Folders start closed, except along the path to a subject the app opened on:
  // a link to a resource three folders deep would otherwise fill the workspace
  // while its own row stayed hidden.
  const [openFolders, setOpenFolders] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        selection?.kind === "resource" ? foldersTo(resourceNodes as NavNode[], leafKey("resource", selection.id)) : [],
      ),
  )

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

  const toggleFolder = (path: string) =>
    setOpenFolders((s) => {
      const next = new Set(s)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })

  const ctx: RowCtx = {
    matches,
    queryActive: filterActive,
    selection,
    activeKey,
    onSelect,
    openFolders,
    onToggleFolder: toggleFolder,
  }

  // The rows a keystroke can reach: whichever list is on screen, folded exactly
  // as the eye sees it. Tools and prompts are flat, so they enter as bare leaves.
  const navNodes: NavNode[] =
    segment === "tool"
      ? model.tools.map((t) => ({
          type: "leaf",
          item: { kind: "tool", id: t.id, label: t.label },
        }))
      : segment === "resource"
        ? (resourceNodes as NavNode[])
        : (promptGroup?.items ?? []).map((i) => ({
            type: "leaf",
            item: { kind: i.kind, id: i.id, label: i.label },
          }))

  const navRows: NavRow[] = flattenNav(navNodes, {
    isOpen: (path) => openFolders.has(path),
    matches,
    queryActive: filterActive,
  })
  const activeRow = navRows.find((r) => r.key === activeKey) ?? null

  // ── command mode ──
  const shown = commanding ? matchCommands(commands, commandQuery(query)) : []
  const commandRows = shown.map((c) => ({
    key: commandKey(c.id),
    receded: false,
  }))
  // Unlike the browse list, the command list always has a highlight: it is
  // reached by typing, and a list you typed your way into should run on ⏎
  // without a preparatory ↓. Derived rather than stored, so narrowing the list
  // moves the highlight to the new best match instead of stranding it.
  const activeCommandKey = commandRows.some((r) => r.key === activeKey) ? activeKey : (commandRows[0]?.key ?? null)
  const activeCommand = shown.find((c) => commandKey(c.id) === activeCommandKey) ?? null

  // A command whose effect you cannot see says so in its own row before the
  // column goes back to browsing — copy-link is the only one (see commands.ts).
  const [receipt, setReceipt] = useState<{ id: string; text: string } | null>(null)

  const runCommandRow = (command: Command) => {
    onRunCommand(command)
    if (command.receipt === undefined) {
      onQuery("")
      return
    }
    setReceipt({ id: command.id, text: command.receipt })
  }

  useEffect(() => {
    if (receipt === null) return
    const id = setTimeout(() => {
      setReceipt(null)
      onQuery("")
    }, 1500)
    return () => clearTimeout(id)
    // onQuery is a fresh closure each render; the receipt is what gates this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt])

  // Pointing at something is also a way of saying "I am here", so a click or a
  // deep link moves the highlight to match; otherwise ↑ from a mouse-made
  // selection would jump back to the top of the list.
  useEffect(() => {
    if (selection === null) return
    setActiveKey(leafKey(selection.kind, selection.id))
  }, [selection])

  // Focus never moves (spec §3.2), so nothing scrolls the highlight into view
  // for us — 155 Hugging Face resources make that the difference between
  // navigable and not.
  useEffect(() => {
    const key = commanding ? activeCommandKey : activeKey
    if (key === null || listRef.current === null) return
    for (const el of listRef.current.querySelectorAll<HTMLElement>("[data-navkey]")) {
      if (el.dataset.navkey === key) {
        el.scrollIntoView({ block: "nearest" })
        return
      }
    }
  }, [activeKey, activeCommandKey, commanding])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      const inTextField =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable === true
      const action = keyAction(e, {
        inTextField,
        inFilter: target?.dataset.filter !== undefined,
        inListButton: tag === "BUTTON" && listRef.current?.contains(target) === true,
        queryActive,
      })
      if (action === null) return
      e.preventDefault()
      switch (action.type) {
        case "focusFilter":
          onFocusFilter()
          return
        case "move":
          setActiveKey(
            moveActive(commanding ? commandRows : navRows, commanding ? activeCommandKey : activeKey, action.delta),
          )
          return
        case "commit":
          if (commanding) {
            if (activeCommand !== null) runCommandRow(activeCommand)
            return
          }
          if (activeRow === null) return
          if (activeRow.type === "leaf") onSelect(activeRow.selection)
          else toggleFolder(activeRow.path)
          return
        case "openFolder":
          if (activeRow?.type === "folder" && !activeRow.open) toggleFolder(activeRow.path)
          return
        case "closeFolder":
          if (activeRow?.type === "folder" && activeRow.open) toggleFolder(activeRow.path)
          return
        case "clearFilter":
          onQuery("")
          return
        case "home":
          onSelect(null)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

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

      {/* The segments stay in place while command mode is on rather than being
          removed: the column's silhouette must not jump, because "nothing
          arrives and nothing leaves" is the whole reason this is not an overlay.
          They recede using the same idiom the list uses for filtered-out rows. */}
      <div className={styles.segments} role="group" aria-label="Kind" data-receded={commanding || undefined}>
        {SEGMENTS.map((kind) => (
          <button
            key={kind}
            type="button"
            className={styles.segment}
            aria-pressed={segment === kind}
            tabIndex={commanding ? -1 : undefined}
            onClick={() => {
              // A different list is a different place; the highlight does not
              // carry over. This lives on the click rather than in an effect on
              // `segment`, which would also fire on mount and wipe the
              // highlight a deep link had just set.
              setSegment(kind)
              setActiveKey(null)
            }}
          >
            {SEGMENT_LABEL[kind]} <span className={styles.count}>{filterActive ? hits[kind] : counts[kind]}</span>
          </button>
        ))}
      </div>

      <motion.div
        ref={listRef}
        className={styles.list}
        variants={igniteContainer(0.12)}
        initial={reduced ? false : "hidden"}
        animate="show"
      >
        {commanding && (
          <div className={styles.commands} role="listbox" aria-label="Commands">
            {shown.length === 0 ? (
              <p className={styles.none}>No command matches that.</p>
            ) : (
              shown.map((command) => (
                <button
                  key={command.id}
                  type="button"
                  role="option"
                  className={styles.commandRow}
                  data-navkey={commandKey(command.id)}
                  data-active={activeCommandKey === commandKey(command.id) || undefined}
                  aria-selected={activeCommandKey === commandKey(command.id)}
                  onClick={() => runCommandRow(command)}
                >
                  <span className={styles.commandLabel}>{command.label}</span>
                  {receipt?.id === command.id ? (
                    <span className={styles.commandReceipt}>{receipt.text}</span>
                  ) : (
                    command.hint && <span className={styles.commandHint}>{command.hint}</span>
                  )}
                </button>
              ))
            )}
            {/* The keys are taught where and when they are live, inside furniture
                that is already on screen — the other half of S2's goal. */}
            <KeyLegend
              pairs={[
                { keys: ["↑", "↓"], means: "move" },
                { keys: ["⏎"], means: "run" },
                { keys: ["esc"], means: "back to filter" },
              ]}
            />
          </div>
        )}

        {!commanding &&
          segment === "tool" &&
          (model.tools.length === 0 ? (
            <p className={styles.none}>This server exposes no tools.</p>
          ) : (
            model.tools.map((tool) => {
              const selected = selection?.kind === "tool" && selection.id === tool.id
              const key = leafKey("tool", tool.id)
              return (
                <motion.button
                  variants={reduced ? undefined : igniteItem}
                  key={tool.id}
                  type="button"
                  className={styles.row}
                  data-kind="tool"
                  data-navkey={key}
                  data-active={activeKey === key || undefined}
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

        {!commanding &&
          segment === "resource" &&
          (resourceNodes.length === 0 ? (
            <p className={styles.none}>This server exposes no resources.</p>
          ) : (
            resourceNodes.map((n) => (
              <motion.div key={nodeKey(n)} variants={reduced ? undefined : igniteItem}>
                <NodeRow node={n} ctx={ctx} />
              </motion.div>
            ))
          ))}

        {!commanding &&
          segment === "prompt" &&
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
