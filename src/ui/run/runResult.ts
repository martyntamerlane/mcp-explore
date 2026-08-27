/**
 * Everything a server returns from tools/call is untrusted (CLAUDE.md security
 * rules): this module reduces an unknown result to plain strings the panel
 * renders as React text nodes only — no HTML, no eval, size-capped.
 */
export const MAX_RESULT_CHARS = 50_000
/** A hostile server can send a million empty content items; the char budget alone would never trip. */
export const MAX_RESULT_BLOCKS = 100

export interface RunDisplay {
  ok: boolean
  blocks: { label?: string; text: string }[]
  truncated: boolean
}

function prettyIfJson(text: string): string {
  // Never parse/pretty-print past the display cap: parsing a multi-megabyte
  // payload (and pretty-printing, which multiplies its size) happens BEFORE the
  // cap slices, so oversized text ships raw and gets sliced by cap().
  if (text.length > MAX_RESULT_CHARS) return text
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
  if (typeof result !== "object" || result === null) {
    return { ok: false, blocks: [{ text: "Unrecognised result shape — the server's response could not be displayed." }], truncated: false }
  }
  const r = result as { content?: unknown; isError?: unknown; structuredContent?: unknown }
  const content = Array.isArray(r.content) ? r.content : []
  const hasStructured = typeof r.structuredContent === "object" && r.structuredContent !== null
  // A structuredContent-only result (no content array) is still a real result.
  if (!Array.isArray(r.content) && !hasStructured) {
    return { ok: false, blocks: [{ text: "Unrecognised result shape — the server's response could not be displayed." }], truncated: false }
  }
  const blocks: { label?: string; text: string }[] = []
  let dropped = 0
  for (const item of content) {
    if (typeof item !== "object" || item === null) continue
    if (blocks.length >= MAX_RESULT_BLOCKS) {
      dropped++
      continue
    }
    const c = item as { type?: unknown; text?: unknown }
    if (c.type === "text" && typeof c.text === "string") {
      blocks.push({ text: prettyIfJson(c.text) })
    } else {
      const kind = typeof c.type === "string" ? c.type : "unknown"
      blocks.push({ text: `(${kind} content — not rendered)` })
    }
  }
  if (dropped > 0) blocks.push({ text: `(+ ${dropped} more content items not shown)` })
  if (hasStructured && blocks.length <= MAX_RESULT_BLOCKS) {
    blocks.push({ label: "structured", text: JSON.stringify(r.structuredContent, null, 2) })
  }
  const capped = cap(blocks)
  return { ok: r.isError !== true, blocks: capped.blocks, truncated: capped.truncated || dropped > 0 }
}

export function formatRunError(error: unknown): RunDisplay {
  const message = error instanceof Error ? error.message : String(error)
  return { ok: false, blocks: [{ text: message }], truncated: false }
}
