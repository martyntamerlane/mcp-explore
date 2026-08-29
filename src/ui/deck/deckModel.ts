import type { Tool } from "@modelcontextprotocol/sdk/types.js"
import type { ServerSnapshot } from "../../mcp/types"
import { fieldSpecs } from "../form/argValues"

export interface DeckTool {
  kind: "tool"
  id: string
  label: string
  blurb?: string
  /** The server flagged this tool read-only. Untrusted — display only, never a permission. */
  readOnly: boolean
  /** No arguments at all: selecting it in the column runs it immediately (spec §4). */
  zeroArg: boolean
}

export interface PromptArgSpec {
  name: string
  required: boolean
  description?: string
}

// One row of the browse column, carrying what its workspace view needs.
export interface BrowseItem {
  kind: "resource" | "prompt"
  id: string
  label: string
  description?: string
  mimeType?: string
  promptArgs?: PromptArgSpec[]
}

export interface BrowseGroup {
  kind: "resource" | "prompt"
  label: string
  items: BrowseItem[]
}

export interface DeckModel {
  tools: DeckTool[]
  groups: BrowseGroup[]
}

// Schemas come from an untrusted server: treat as unknown, narrow defensively.
export function requiredArgCount(schema: unknown): number {
  if (typeof schema !== "object" || schema === null) return 0
  const required = (schema as { required?: unknown }).required
  return Array.isArray(required) ? required.filter((r) => typeof r === "string").length : 0
}

/**
 * A tool with no properties at all runs on a single click; anything else opens
 * its form first (tool-first workspace spec §4). Transport no longer matters —
 * forms make every tool runnable, so the old in-memory-only carve-out is gone.
 */
export function isZeroArg(tool: Tool): boolean {
  return fieldSpecs(tool.inputSchema).length === 0
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

export function buildDeckModel(snapshot: ServerSnapshot): DeckModel {
  const tools = dedupe(
    snapshot.tools.map((t) => ({
      kind: "tool" as const,
      id: t.name,
      label: t.name,
      blurb: firstLine(t.description),
      readOnly: t.annotations?.readOnlyHint === true,
      zeroArg: isZeroArg(t),
    })),
  )
  const groups: BrowseGroup[] = [
    {
      kind: "resource",
      label: "Resources",
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
  return { tools, groups }
}
