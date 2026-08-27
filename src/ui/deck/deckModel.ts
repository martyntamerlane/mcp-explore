import type { Tool } from "@modelcontextprotocol/sdk/types.js"
import type { ServerSnapshot, TransportKind } from "../../mcp/types"

/**
 * How a click on a tool button behaves (redesign spec §4):
 * - "instant": runnable + readOnlyHint — runs on a single click
 * - "arm": runnable but not read-only-hinted — arm, then fire
 * - "input-required": not runnable in this slice — click opens the detail panel
 */
export type RunClass = "instant" | "arm" | "input-required"

export interface DeckTool {
  kind: "tool"
  id: string
  label: string
  blurb?: string
  runClass: RunClass
}

export interface PromptArgSpec {
  name: string
  required: boolean
  description?: string
}

// Rail rows unfold in place (rail-browser spec): the item carries everything
// the unfolded row shows without a trip to the detail panel.
export interface RailItem {
  kind: "resource" | "prompt"
  id: string
  label: string
  description?: string
  mimeType?: string
  promptArgs?: PromptArgSpec[]
}

export interface RailGroup {
  kind: "resource" | "prompt"
  label: string
  gloss: string
  items: RailItem[]
}

export type DeckEmphasis = "regular" | "tool-light"

export interface DeckModel {
  tools: DeckTool[]
  rail: RailGroup[]
  emphasis: DeckEmphasis
}

/** Tool-light servers must not render a vast empty centre — the rail widens instead. */
const TOOL_LIGHT_MAX = 4

// Schemas come from an untrusted server: treat as unknown, narrow defensively.
export function requiredArgCount(schema: unknown): number {
  if (typeof schema !== "object" || schema === null) return 0
  const required = (schema as { required?: unknown }).required
  return Array.isArray(required) ? required.filter((r) => typeof r === "string").length : 0
}

// Eligibility (spec §5): every demo (in-memory) tool, plus any tool whose schema
// requires no arguments. readOnlyHint is untrusted — accepted only for the
// single-click class, and only combined with runnability.
export function classifyTool(tool: Tool, transportKind: TransportKind): RunClass {
  const runnable = transportKind === "in-memory" || requiredArgCount(tool.inputSchema) === 0
  if (!runnable) return "input-required"
  return tool.annotations?.readOnlyHint === true ? "instant" : "arm"
}

function firstLine(text: string | undefined): string | undefined {
  const line = text?.split("\n").find((l) => l.trim() !== "")
  return line?.trim()
}

// Duplicate ids would collide as React keys and make selection ambiguous; first wins.
function dedupe<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)))
}

export function buildDeckModel(snapshot: ServerSnapshot, transportKind: TransportKind): DeckModel {
  const tools = dedupe(
    snapshot.tools.map((t) => ({
      kind: "tool" as const,
      id: t.name,
      label: t.name,
      blurb: firstLine(t.description),
      runClass: classifyTool(t, transportKind),
    })),
  )
  const rail: RailGroup[] = [
    {
      kind: "resource",
      label: "Resources",
      gloss: "data it exposes",
      items: dedupe(
        snapshot.resources.map((r) => ({
          kind: "resource" as const,
          id: r.uri,
          label: r.name,
          description: r.description,
          mimeType: typeof r.mimeType === "string" ? r.mimeType : undefined,
        })),
      ),
    },
    {
      kind: "prompt",
      label: "Prompts",
      gloss: "ready-made instructions",
      items: dedupe(
        snapshot.prompts.map((p) => ({
          kind: "prompt" as const,
          id: p.name,
          label: p.name,
          description: p.description,
          promptArgs: (Array.isArray(p.arguments) ? p.arguments : []).map((a) => ({
            name: a.name,
            required: a.required === true,
            description: a.description,
          })),
        })),
      ),
    },
  ]
  return { tools, rail, emphasis: tools.length <= TOOL_LIGHT_MAX ? "tool-light" : "regular" }
}
