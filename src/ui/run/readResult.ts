import { MAX_RESULT_BLOCKS, MAX_RESULT_CHARS, prettyIfJson } from "./runResult"

/**
 * Reduces untrusted resources/read and prompts/get results to plain blocks the
 * rail renders inline (rail-browser spec §2). Same security posture as
 * runResult: React text nodes only, no HTML, no eval, size-capped. Images are
 * the one rich exception — data: URIs built here from a server blob, with the
 * mime type constrained to image/*.
 */
export interface ReadBlock {
  label?: string
  text?: string
  image?: { src: string; alt: string }
}

export interface ReadDisplay {
  ok: boolean
  blocks: ReadBlock[]
  truncated: boolean
}

const UNRECOGNISED: ReadDisplay = {
  ok: false,
  blocks: [{ text: "Unrecognised result shape — the server's response could not be displayed." }],
  truncated: false,
}

// Text blocks share one char budget; image blocks pass through uncounted
// (their cost is the already-received blob, not render size).
function cap(blocks: ReadBlock[]): { blocks: ReadBlock[]; truncated: boolean } {
  let budget = MAX_RESULT_CHARS
  const out: ReadBlock[] = []
  let truncated = false
  for (const b of blocks) {
    if (b.text === undefined) {
      out.push(b)
      continue
    }
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

export function formatResourceContents(result: unknown): ReadDisplay {
  if (typeof result !== "object" || result === null) return UNRECOGNISED
  const contents = (result as { contents?: unknown }).contents
  if (!Array.isArray(contents)) return UNRECOGNISED

  const blocks: ReadBlock[] = []
  let dropped = 0
  for (const item of contents) {
    if (typeof item !== "object" || item === null) continue
    if (blocks.length >= MAX_RESULT_BLOCKS) {
      dropped++
      continue
    }
    const c = item as { uri?: unknown; mimeType?: unknown; text?: unknown; blob?: unknown }
    const mime = typeof c.mimeType === "string" ? c.mimeType : undefined
    if (typeof c.text === "string") {
      blocks.push({ text: prettyIfJson(c.text) })
    } else if (typeof c.blob === "string") {
      if (mime?.startsWith("image/")) {
        const alt = typeof c.uri === "string" ? c.uri : "resource image"
        blocks.push({ image: { src: `data:${mime};base64,${c.blob}`, alt } })
      } else {
        blocks.push({ text: `(binary ${mime ?? "unknown type"} — not rendered)` })
      }
    } else {
      blocks.push({ text: "(empty content item)" })
    }
  }
  if (dropped > 0) blocks.push({ text: `(+ ${dropped} more content items not shown)` })
  const capped = cap(blocks)
  return { ok: true, blocks: capped.blocks, truncated: capped.truncated || dropped > 0 }
}

export function formatPromptMessages(result: unknown): ReadDisplay {
  if (typeof result !== "object" || result === null) return UNRECOGNISED
  const messages = (result as { messages?: unknown }).messages
  if (!Array.isArray(messages)) return UNRECOGNISED

  const blocks: ReadBlock[] = []
  for (const item of messages) {
    if (typeof item !== "object" || item === null) continue
    if (blocks.length >= MAX_RESULT_BLOCKS) break
    const m = item as { role?: unknown; content?: unknown }
    const label = typeof m.role === "string" ? m.role : undefined
    const content = (typeof m.content === "object" && m.content !== null ? m.content : {}) as {
      type?: unknown
      text?: unknown
    }
    if (content.type === "text" && typeof content.text === "string") {
      blocks.push({ label, text: content.text })
    } else {
      const kind = typeof content.type === "string" ? content.type : "unknown"
      blocks.push({ label, text: `(${kind} content — not rendered)` })
    }
  }
  if (blocks.length === 0) return UNRECOGNISED
  const capped = cap(blocks)
  return { ok: true, blocks: capped.blocks, truncated: capped.truncated }
}

export function formatReadError(error: unknown): ReadDisplay {
  const message = error instanceof Error ? error.message : String(error)
  return { ok: false, blocks: [{ text: message }], truncated: false }
}
