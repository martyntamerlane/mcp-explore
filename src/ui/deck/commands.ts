import type { Mode } from "../mode"

/**
 * Command mode (interaction roadmap S2 / TODO-26).
 *
 * Typing `>` in the chrome band's filter turns it into a command line. There is
 * deliberately no ⌘K overlay: every source points at one, and an overlay is the
 * archetypal arriving surface this project has twice rejected. The filter is
 * permanent furniture that takes a second job, and the browse column below it
 * changes contents rather than being covered by something new.
 *
 * Pure by design, like `keynav.ts`: what the commands are, which of them apply
 * right now, how a query narrows them, and what each one calls are all decidable
 * without React, so all four are tested as functions.
 *
 * Every command is a second route to an action that already exists in the UI —
 * command mode adds no capability of its own.
 */

export type CommandId = "home" | "copyLink" | "showRaw" | "showRendered" | "toggleTheme" | "disconnect"

export interface Command {
  id: CommandId
  label: string
  /** The quiet second line: what it does, where the label alone is not enough. */
  hint?: string
  /** Words that should find this command without appearing in its label. */
  keywords?: string[]
  /**
   * Commands whose effect is invisible confirm themselves in their own row
   * before the column returns to browsing. Everything else is self-evident —
   * the theme changes, the subject changes, the connection drops.
   */
  receipt?: string
}

export interface CommandContext {
  /** Home is only somewhere to go from somewhere else, and only a subject has a link. */
  hasSelection: boolean
  mode: Mode
  /** Whether anything on screen is currently showing its raw bytes. */
  raw: boolean
  /** Whether anything on screen is rendered markdown that *could* show its raw bytes. */
  hasRenderable: boolean
}

/** The filter is in command mode. `>` is the whole signal — one character, no space required. */
export const isCommandQuery = (query: string): boolean => query.startsWith(">")

/** What the user has typed *after* the `>`, normalised for matching. */
export const commandQuery = (query: string): string => query.slice(1).trim().toLowerCase()

/**
 * The commands that make sense right now, in the order they are worth offering.
 *
 * Two of them change identity rather than availability: the theme command names
 * the mode it moves to, and raw/rendered is one row that names the direction it
 * would travel — a list offering both "Show raw" and "Show rendered" at once
 * would be asking the user to work out which one is currently true.
 */
export function availableCommands(ctx: CommandContext): Command[] {
  const list: Command[] = []
  if (ctx.hasSelection) {
    list.push({
      id: "home",
      label: "Home",
      hint: "the server's overview",
      keywords: ["overview", "back"],
    })
    list.push({
      id: "copyLink",
      label: "Copy link to this selection",
      hint: "a URL that opens exactly this",
      keywords: ["share", "url", "address"],
      receipt: "Link copied",
    })
  }
  if (ctx.hasRenderable) {
    list.push(
      ctx.raw
        ? {
            id: "showRendered",
            label: "Show rendered",
            hint: "render the markdown again",
            keywords: ["markdown"],
          }
        : {
            id: "showRaw",
            label: "Show raw",
            hint: "the exact bytes the server sent",
            keywords: ["markdown", "source"],
          },
    )
  }
  list.push({
    id: "toggleTheme",
    label: ctx.mode === "dark" ? "Switch to light mode" : "Switch to dark mode",
    hint: "remembered on this device",
    keywords: ["theme", "dark", "light", "appearance"],
  })
  // Disconnecting *is* connecting: it returns to the connect screen, which is
  // where a new server is chosen. Two rows for one code path would be furniture
  // that lies about having two outcomes.
  list.push({
    id: "disconnect",
    label: "Disconnect",
    hint: "return to the connect screen",
    keywords: ["connect", "server", "leave", "quit"],
  })
  return list
}

/**
 * Narrow by what has been typed, best first.
 *
 * Ranked rather than merely filtered, because the ranks are what make a short
 * query land somewhere predictable: "co" should reach "Copy link" before
 * "Disconnect", which contains "co" in the middle of a word nobody was typing.
 * A keyword-only hit sorts last — it found a command the words on screen did
 * not name, so it has the least claim to being what was meant.
 */
export function matchCommands(commands: readonly Command[], query: string): Command[] {
  if (query === "") return [...commands]
  const scored: { command: Command; rank: number; at: number }[] = []
  commands.forEach((command, at) => {
    const label = command.label.toLowerCase()
    const rank = label.startsWith(query)
      ? 0
      : label.split(/\s+/).some((word) => word.startsWith(query))
        ? 1
        : label.includes(query)
          ? 2
          : (command.keywords ?? []).some((k) => k.startsWith(query))
            ? 3
            : -1
    if (rank !== -1) scored.push({ command, rank, at })
  })
  return scored.sort((a, b) => a.rank - b.rank || a.at - b.at).map((s) => s.command)
}

/** The row key a command occupies in the browse column, in the `keynav` key space. */
export const commandKey = (id: CommandId): string => `command:${id}`

export interface CommandHandlers {
  home: () => void
  copyLink: () => void
  setRaw: (raw: boolean) => void
  toggleTheme: () => void
  disconnect: () => void
}

/**
 * What a command does, as a mapping rather than as a switch buried in a
 * component: the handlers arrive from whoever owns each piece of state, so this
 * stays testable with spies and the dispatch table is readable in one place.
 */
export function runCommand(id: CommandId, handlers: CommandHandlers): void {
  switch (id) {
    case "home":
      return handlers.home()
    case "copyLink":
      return handlers.copyLink()
    case "showRaw":
      return handlers.setRaw(true)
    case "showRendered":
      return handlers.setRaw(false)
    case "toggleTheme":
      return handlers.toggleTheme()
    case "disconnect":
      return handlers.disconnect()
  }
}
