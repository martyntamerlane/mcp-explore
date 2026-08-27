/**
 * Everything a server returns from tools/call is untrusted (CLAUDE.md security
 * rules): this module reduces an unknown result to plain strings the panel
 * renders as React text nodes only — no HTML, no eval, size-capped.
 */
export const MAX_RESULT_CHARS = 50_000

export interface RunDisplay {
  ok: boolean
  blocks: { label?: string; text: string }[]
  truncated: boolean
}

function prettyIfJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}

function cap(blocks: { label?: string; text: string }[]): { blocks: RunDisplay["blocks"]; truncated: boolean } {
  let budget = MAX_RESULT_CHARS
  const out: { label?: string; text: string }[] = []
  let truncated = false
  for (const b of blocks) {
    if (budget <= 0) {
      truncated = true
      break
    }
    if (b.text.length > budget) {
      out.push({ ...b, text: b.text.slice(0, budget) })
      truncated = true
      budget = 0
    } else {
      out.push(b)
      budget -= b.text.length
    }
  }
  return { blocks: out, truncated }
}

export function formatCallResult(result: unknown): RunDisplay {
  if (typeof result !== "object" || result === null || !Array.isArray((result as { content?: unknown }).content)) {
    return { ok: false, blocks: [{ text: "Unrecognised result shape — the server's response could not be displayed." }], truncated: false }
  }
  const r = result as { content: unknown[]; isError?: unknown; structuredContent?: unknown }
  const blocks: { label?: string; text: string }[] = []
  for (const item of r.content) {
    if (typeof item !== "object" || item === null) continue
    const c = item as { type?: unknown; text?: unknown }
    if (c.type === "text" && typeof c.text === "string") {
      blocks.push({ text: prettyIfJson(c.text) })
    } else {
      const kind = typeof c.type === "string" ? c.type : "unknown"
      blocks.push({ text: `(${kind} content — not rendered)` })
    }
  }
  if (typeof r.structuredContent === "object" && r.structuredContent !== null) {
    blocks.push({ label: "structured", text: JSON.stringify(r.structuredContent, null, 2) })
  }
  const capped = cap(blocks)
  return { ok: r.isError !== true, blocks: capped.blocks, truncated: capped.truncated }
}

export function formatRunError(error: unknown): RunDisplay {
  const message = error instanceof Error ? error.message : String(error)
  return { ok: false, blocks: [{ text: message }], truncated: false }
}
