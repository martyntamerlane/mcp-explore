/**
 * A small markdown subset parser: untrusted string in, plain data out.
 *
 * Hand-rolled rather than pulled from npm for two reasons (see
 * docs/specs/2026-08-29-markdown-rendering.md): the bundle is already over
 * Vite's warning limit (TODO-8), and — more importantly — a parser that emits
 * data with no HTML in it cannot inject HTML however hostile its input is. The
 * renderer turns this tree into React elements; nothing downstream ever sees a
 * string it could be tempted to pass to dangerouslySetInnerHTML.
 *
 * Covers what MCP servers actually emit: ATX headings, fenced code, bullet and
 * ordered lists (nested), blockquotes, GFM tables, thematic breaks, paragraphs;
 * inline code, bold, italic, strikethrough, links, autolinks and images. Not
 * CommonMark-complete and not trying to be — reference links, setext headings
 * and footnotes fall through to plain text, which is honest.
 *
 * Block-level HTML is the one exception, added 2026-08-29: a line that is
 * nothing but a known HTML tag is dropped, and a line that is a known tag pair
 * wrapped around text keeps the text. Deepwiki opens every result with
 * `<details>` / `<summary>Relevant source files</summary>`, which used to render
 * as literal angle brackets two lines into every response. Dropping the tag is
 * not the same as supporting HTML — nothing here ever emits markup.
 */

export type Inline =
  | { type: "text"; value: string }
  | { type: "code"; value: string }
  | { type: "strong"; children: Inline[] }
  | { type: "em"; children: Inline[] }
  | { type: "del"; children: Inline[] }
  | { type: "link"; href: string; children: Inline[] }
  /** Never an img element: `href` is null when the source was not a safe URL. */
  | { type: "image"; href: string | null; alt: string }

export type Align = "left" | "center" | "right" | null

export type Block =
  /** `id` is stamped by parseDocument, not by parseBlocks — see below. */
  | { type: "heading"; level: number; children: Inline[]; id?: string }
  | { type: "paragraph"; children: Inline[] }
  | { type: "code"; lang?: string; value: string }
  | { type: "list"; ordered: boolean; start: number; items: Block[][] }
  | { type: "quote"; children: Block[] }
  | { type: "table"; align: Align[]; head: Inline[][]; rows: Inline[][][] }
  | { type: "rule" }

/** Hostile input can nest forever; past this, content renders as plain text. */
const MAX_BLOCK_DEPTH = 6
const MAX_INLINE_DEPTH = 4

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})[ \t]*(\S*)[^\n]*$/
const HEADING = /^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/
const RULE = /^ {0,3}([-*_])[ \t]*(?:\1[ \t]*){2,}$/
const BULLET = /^( *)([-*+])[ \t]+(.*)$/
const ORDERED = /^( *)(\d{1,9})[.)][ \t]+(.*)$/
const QUOTE = /^ {0,3}> ?(.*)$/

/**
 * Element names recognised in the HTML-block rules below. An allowlist rather
 * than a general `<[a-z]+>` pattern on purpose: a line of prose that happens to
 * read `<not a tag>` matches any permissive pattern, and silently deleting a
 * line of a server's output is a worse failure than printing one stray tag.
 */
const HTML_ELEMENTS =
  "details|summary|div|span|p|br|hr|img|picture|source|center|figure|figcaption|" +
  "b|i|u|s|small|sub|sup|strong|em|mark|kbd|abbr|a|code|pre|blockquote|" +
  "table|thead|tbody|tfoot|tr|td|th|caption|colgroup|col|ul|ol|li|dl|dt|dd|h[1-6]"

/** A line that is one tag and nothing else: `<details>`, `</details>`, `<br />`. */
const HTML_TAG_ONLY = new RegExp(`^ {0,3}</?(?:${HTML_ELEMENTS})(?:\\s[^>]*)?/?>[ \\t]*$`, "i")

/** A line that is one tag pair around text: `<summary>Relevant source files</summary>`. */
const HTML_WRAPPED = new RegExp(`^ {0,3}<(${HTML_ELEMENTS})(?:\\s[^>]*)?>(.*)</\\1>[ \\t]*$`, "i")
const BLANK = /^[ \t]*$/
const LEADING_SPACE = /^ +/

/**
 * Only http(s) and mailto survive. Everything else — javascript:, data:, other
 * schemes, protocol-relative host references, and relative paths (which would
 * resolve against *our* origin, not the server's) — renders as inert text.
 */
export function safeHref(raw: string): string | null {
  const url = raw.trim()
  if (url === "") return null
  if (/\s/.test(url)) return null
  if (/^(https?:|mailto:)/i.test(url)) return url
  return null
}

function splitRow(line: string): string[] {
  const cells: string[] = []
  let cur = ""
  for (let i = 0; i < line.length; i++) {
    if (line[i] === "\\" && line[i + 1] === "|") {
      cur += "|"
      i++
    } else if (line[i] === "|") {
      cells.push(cur)
      cur = ""
    } else {
      cur += line[i]
    }
  }
  cells.push(cur)
  // A leading/trailing pipe produces an empty edge cell that isn't a column.
  if (cells.length > 1 && cells[0].trim() === "") cells.shift()
  if (cells.length > 1 && cells[cells.length - 1].trim() === "") cells.pop()
  return cells.map((c) => c.trim())
}

function alignmentRow(line: string): Align[] | null {
  if (!line.includes("-")) return null
  const cells = splitRow(line)
  if (cells.length === 0) return null
  const align: Align[] = []
  for (const cell of cells) {
    const m = /^(:?)-+(:?)$/.exec(cell)
    if (!m) return null
    align.push(m[1] && m[2] ? "center" : m[2] ? "right" : m[1] ? "left" : null)
  }
  return align
}

function leadingSpaces(line: string): number {
  return line.length - line.replace(LEADING_SPACE, "").length
}

/** Strip up to `n` leading spaces from each line, for nested block content. */
function dedent(lines: string[], n: number): string[] {
  return lines.map((l) => {
    let i = 0
    while (i < n && (l[i] === " " || l[i] === "\t")) i++
    return l.slice(i)
  })
}

function startsBlock(line: string): boolean {
  return (
    HEADING.test(line) ||
    RULE.test(line) ||
    FENCE_OPEN.test(line) ||
    QUOTE.test(line) ||
    BULLET.test(line) ||
    ORDERED.test(line) ||
    HTML_TAG_ONLY.test(line) ||
    HTML_WRAPPED.test(line)
  )
}

export function parseBlocks(src: string, depth = 0): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n")
  const out: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (BLANK.test(line)) {
      i++
      continue
    }

    // fenced code
    const fence = FENCE_OPEN.exec(line)
    if (fence) {
      const marker = fence[1][0]
      const close = new RegExp("^ {0,3}\\" + marker + "{" + fence[1].length + ",}[ \\t]*$")
      const body: string[] = []
      i++
      while (i < lines.length && !close.test(lines[i])) {
        body.push(lines[i])
        i++
      }
      i++ // consume the closing fence, or run off the end, which is fine
      out.push({ type: "code", value: body.join("\n"), ...(fence[2] ? { lang: fence[2] } : {}) })
      continue
    }

    // Block-level HTML: drop the tag, keep any text it wrapped. Checked before
    // the table rule so a `<td>` line can never be read as a table row.
    if (HTML_TAG_ONLY.test(line)) {
      i++
      continue
    }
    const wrapped = HTML_WRAPPED.exec(line)
    if (wrapped) {
      const inner = wrapped[2].trim()
      if (inner !== "") out.push({ type: "paragraph", children: parseInline(inner) })
      i++
      continue
    }

    if (RULE.test(line)) {
      out.push({ type: "rule" })
      i++
      continue
    }

    const heading = HEADING.exec(line)
    if (heading) {
      // The workspace's subject is an h2, so content headings start at h3 and
      // the document outline stays sane.
      out.push({
        type: "heading",
        level: Math.min(6, heading[1].length + 2),
        children: parseInline(heading[2]),
      })
      i++
      continue
    }

    // blockquote
    if (QUOTE.test(line)) {
      const body: string[] = []
      while (i < lines.length && !BLANK.test(lines[i])) {
        const m = QUOTE.exec(lines[i])
        body.push(m ? m[1] : lines[i]) // lazy continuation
        i++
      }
      out.push(
        depth < MAX_BLOCK_DEPTH
          ? { type: "quote", children: parseBlocks(body.join("\n"), depth + 1) }
          : { type: "paragraph", children: parseInline(body.join(" ")) },
      )
      continue
    }

    // GFM table: a header row, then a delimiter row of the same width
    if (line.includes("|") && i + 1 < lines.length) {
      const align = alignmentRow(lines[i + 1])
      const head = splitRow(line)
      if (align && align.length === head.length) {
        i += 2
        const rows: Inline[][][] = []
        while (i < lines.length && !BLANK.test(lines[i]) && lines[i].includes("|")) {
          const cells = splitRow(lines[i])
          // Pad or trim to the header's width so the grid stays rectangular.
          rows.push(Array.from({ length: head.length }, (_, c) => parseInline(cells[c] ?? "")))
          i++
        }
        out.push({ type: "table", align, head: head.map((h) => parseInline(h)), rows })
        continue
      }
    }

    // lists
    const bullet = BULLET.exec(line)
    const ordered = ORDERED.exec(line)
    if (bullet !== null || ordered !== null) {
      const isOrdered = bullet === null
      const startAt = isOrdered ? parseInt(ordered![2], 10) : 1
      const items: Block[][] = []
      while (i < lines.length) {
        const m = isOrdered ? ORDERED.exec(lines[i]) : BULLET.exec(lines[i])
        if (m === null) break
        const contentIndent = m[1].length + m[2].length + 1
        const body = [m[3]]
        i++
        // Continuation: indented lines, plus blank lines with more indented
        // content after them.
        while (i < lines.length) {
          if (BLANK.test(lines[i])) {
            const next = lines[i + 1]
            if (next === undefined || BLANK.test(next)) break
            if (leadingSpaces(next) < contentIndent) break
            body.push("")
            i++
            continue
          }
          if (leadingSpaces(lines[i]) < contentIndent) break
          body.push(lines[i])
          i++
        }
        const inner = dedent(body, contentIndent).join("\n")
        items.push(
          depth < MAX_BLOCK_DEPTH
            ? parseBlocks(inner, depth + 1)
            : [{ type: "paragraph", children: parseInline(inner) }],
        )
      }
      out.push({ type: "list", ordered: isOrdered, start: startAt, items })
      continue
    }

    // paragraph
    const para: string[] = []
    while (i < lines.length && !BLANK.test(lines[i])) {
      if (para.length > 0 && startsBlock(lines[i])) break
      para.push(lines[i])
      i++
    }
    out.push({ type: "paragraph", children: parseInline(para.join("\n")) })
  }

  return out
}

const ESCAPABLE = /[\\`*_{}[\]()#+\-.!|~>]/
const CODE_SPAN = /^(`+)([\s\S]*?[^`])\1(?!`)/
const AUTOLINK = /^<((?:https?:\/\/|mailto:)[^>\s]+)>/i

/**
 * A scan budget, because the two scanners below are quadratic on hostile input
 * (ISSUE-13).
 *
 * `closingIndex` and `matchLink` both run to the end of the string when there is
 * nothing to find, and `parseInline` then advances a single character and asks
 * again — so 50,000 unmatched `~~` markers cost 50,000 full scans. Measured
 * before this existed: 4.9 s of blocked main thread at exactly the 50,000-char
 * display cap, doubled because the result outline parses the same text again.
 *
 * A budget rather than a length cap, deliberately. A length cap would send long
 * documents to a <pre>, and deepwiki's `read_wiki_contents` is exactly the long
 * markdown this app exists to read. Real markdown scans about linearly: 50,000
 * characters of prose, headings, tables, lists and matched emphasis parse in
 * 17 ms and spend a small fraction of this. Hostile input exhausts it and the
 * remaining markers stay literal text — the same graceful degradation an
 * unmatched marker already gets, so nothing the server wrote is ever hidden.
 *
 * Sized per top-level `parseInline` call and proportional to that call's own
 * input, with only a small flat term, so a document split into many short pieces
 * (a table of thousands of cells) cannot add up to more than linear total work.
 */
const SCAN_BUDGET_PER_CHAR = 8
const SCAN_BUDGET_FLOOR = 64

/**
 * Module-level because both scanners are leaves of one synchronous call tree and
 * threading a counter through every frame would bury the parsing logic. Reset by
 * the depth-0 `parseInline`; nested calls share what is left.
 */
let scanBudget = 0

/**
 * Matches `[label](dest "title")` starting at the `[`. Scanned rather than
 * matched by regex because both halves nest: `[see [1]](…)` in the label, and
 * balanced parens in the destination — a regex that stops at the first `)`
 * swallows `javascript:alert(1` and leaves a stray `)` in the output.
 */
function matchLink(src: string, from: number): { label: string; dest: string; end: number } | null {
  let i = from + 1
  let depth = 1
  let label = ""
  while (i < src.length) {
    if (scanBudget-- <= 0) return null
    const ch = src[i]
    if (ch === "\\" && i + 1 < src.length) {
      label += ch + src[i + 1]
      i += 2
      continue
    }
    if (ch === "[") depth++
    if (ch === "]") {
      depth--
      if (depth === 0) break
    }
    label += ch
    i++
  }
  if (src[i] !== "]") return null
  i++
  if (src[i] !== "(") return null
  i++

  while (i < src.length && /\s/.test(src[i])) i++
  let dest = ""
  let parens = 0
  while (i < src.length) {
    if (scanBudget-- <= 0) return null
    const ch = src[i]
    if (ch === "\\" && i + 1 < src.length) {
      dest += src[i + 1]
      i += 2
      continue
    }
    if (/\s/.test(ch)) break
    if (ch === "(") parens++
    if (ch === ")") {
      if (parens === 0) break
      parens--
    }
    dest += ch
    i++
  }

  while (i < src.length && /\s/.test(src[i])) i++
  const quote = src[i]
  if (quote === '"' || quote === "'") {
    i++
    while (i < src.length && src[i] !== quote) i += src[i] === "\\" ? 2 : 1
    i++
    while (i < src.length && /\s/.test(src[i])) i++
  }
  if (src[i] !== ")") return null
  return { label, dest, end: i + 1 }
}
const BARE_URL = /^https?:\/\/[^\s<>()[\]"'`]+[^\s<>()[\]"'`.,;:!?]/i
const PAD = /^ ([\s\S]*) $/

/** `_` never emphasises inside a word: snake_case names are everywhere here. */
function underscoreAllowed(src: string, at: number): boolean {
  if (at === 0) return true
  return /[\s\p{P}]/u.test(src[at - 1])
}

function closingIndex(src: string, from: number, marker: string): number {
  let i = from
  while (i < src.length) {
    if (scanBudget-- <= 0) return -1
    if (src[i] === "\\") {
      i += 2
      continue
    }
    if (src.startsWith(marker, i)) {
      // No empty spans, and no closing marker hanging off a space.
      if (i > from && !/\s/.test(src[i - 1])) return i
    }
    i++
  }
  return -1
}

export function parseInline(src: string, depth = 0): Inline[] {
  // The outermost call owns the budget; nested emphasis shares what it left.
  if (depth === 0) scanBudget = src.length * SCAN_BUDGET_PER_CHAR + SCAN_BUDGET_FLOOR
  const out: Inline[] = []
  let text = ""
  let i = 0

  const flush = () => {
    if (text !== "") {
      out.push({ type: "text", value: text })
      text = ""
    }
  }

  while (i < src.length) {
    const c = src[i]
    const rest = src.slice(i)

    if (c === "\\" && i + 1 < src.length && ESCAPABLE.test(src[i + 1])) {
      text += src[i + 1]
      i += 2
      continue
    }

    if (c === "`") {
      const m = CODE_SPAN.exec(rest)
      if (m) {
        flush()
        // A code span's surrounding single spaces are padding, not content.
        out.push({ type: "code", value: m[2].replace(PAD, "$1") })
        i += m[0].length
        continue
      }
    }

    if (c === "!" && src[i + 1] === "[") {
      const m = matchLink(src, i + 1)
      if (m) {
        flush()
        out.push({ type: "image", href: safeHref(m.dest), alt: m.label })
        i = m.end
        continue
      }
    }

    if (c === "[" && depth < MAX_INLINE_DEPTH) {
      const m = matchLink(src, i)
      if (m) {
        const href = safeHref(m.dest)
        flush()
        // An unsafe destination loses the link but keeps the label's text —
        // nothing the server wrote is hidden, it just isn't clickable.
        if (href) out.push({ type: "link", href, children: parseInline(m.label, depth + 1) })
        else out.push(...parseInline(m.label, depth + 1))
        i = m.end
        continue
      }
    }

    if (c === "<") {
      const m = AUTOLINK.exec(rest)
      if (m) {
        const href = safeHref(m[1])
        flush()
        if (href) out.push({ type: "link", href, children: [{ type: "text", value: m[1] }] })
        else out.push({ type: "text", value: m[0] })
        i += m[0].length
        continue
      }
    }

    if ((c === "h" || c === "H") && BARE_URL.test(rest)) {
      const m = BARE_URL.exec(rest)
      const href = m === null ? null : safeHref(m[0])
      if (m !== null && href !== null) {
        flush()
        out.push({ type: "link", href, children: [{ type: "text", value: m[0] }] })
        i += m[0].length
        continue
      }
    }

    if (depth < MAX_INLINE_DEPTH) {
      const pair = rest.slice(0, 2)

      if (pair === "~~") {
        const end = closingIndex(src, i + 2, "~~")
        if (end !== -1) {
          flush()
          out.push({ type: "del", children: parseInline(src.slice(i + 2, end), depth + 1) })
          i = end + 2
          continue
        }
      }

      if ((pair === "**" || pair === "__") && !/\s/.test(src[i + 2] ?? " ")) {
        if (pair === "**" || underscoreAllowed(src, i)) {
          const end = closingIndex(src, i + 2, pair)
          if (end !== -1) {
            flush()
            out.push({ type: "strong", children: parseInline(src.slice(i + 2, end), depth + 1) })
            i = end + 2
            continue
          }
        }
      }

      if ((c === "*" || c === "_") && !/[\s*_]/.test(src[i + 1] ?? " ")) {
        if (c === "*" || underscoreAllowed(src, i)) {
          const end = closingIndex(src, i + 1, c)
          const after = src[end + 1] ?? ""
          if (end !== -1 && (c === "*" || after === "" || /[\s\p{P}]/u.test(after))) {
            flush()
            out.push({ type: "em", children: parseInline(src.slice(i + 1, end), depth + 1) })
            i = end + 1
            continue
          }
        }
      }
    }

    text += c
    i++
  }

  flush()
  return out
}


/* ── document headings (interaction roadmap S4 / TODO-29) ──
   The result outline needs a stable anchor per heading, and the anchor in the
   outline must be the anchor in the rendered document or clicking it goes
   nowhere. Both come from `parseDocument`, so they agree by construction rather
   than by two implementations happening to match. */

export interface HeadingRef {
  id: string
  level: number
  text: string
}

/** A heading's plain text, for slugging and for the outline's own label. */
export function inlineText(nodes: Inline[]): string {
  return nodes
    .map((n) => {
      switch (n.type) {
        case "text":
        case "code":
          return n.value
        case "image":
          return n.alt
        default:
          return inlineText(n.children)
      }
    })
    .join("")
}

/** Enough for an id; a heading longer than this is already unusable as a label. */
const MAX_SLUG_CHARS = 60

/**
 * Headings come from an untrusted server, so this must be total: emoji-only,
 * empty, punctuation-only and 500-character headings all have to produce a
 * usable id. Anything that is not a letter or a number becomes a separator, and
 * a heading that survives that as nothing at all is called "section".
 */
export function slugify(text: string): string {
  const base = text
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_CHARS)
    .replace(/-+$/g, "")
  return base === "" ? "section" : base
}

/**
 * Parse, then stamp every heading with a unique id in document order.
 *
 * The prefix scopes ids to one block of a multi-block result: two blocks can
 * each open with "## Overview", and two elements sharing a DOM id would send
 * every outline link to the first one.
 */
export function parseDocument(text: string, idPrefix = ""): Block[] {
  const blocks = parseBlocks(text)
  const taken = new Map<string, number>()
  const walk = (list: Block[]) => {
    for (const block of list) {
      if (block.type === "heading") {
        const base = slugify(inlineText(block.children))
        const seen = (taken.get(base) ?? 0) + 1
        taken.set(base, seen)
        const unique = seen === 1 ? base : `${base}-${seen}`
        block.id = idPrefix === "" ? unique : `${idPrefix}-${unique}`
      } else if (block.type === "quote") {
        walk(block.children)
      } else if (block.type === "list") {
        block.items.forEach(walk)
      }
    }
  }
  walk(blocks)
  return blocks
}

/** The headings of a parsed document, in order. Ids come from parseDocument. */
export function documentHeadings(blocks: Block[]): HeadingRef[] {
  const out: HeadingRef[] = []
  const walk = (list: Block[]) => {
    for (const block of list) {
      if (block.type === "heading") {
        if (block.id !== undefined) out.push({ id: block.id, level: block.level, text: inlineText(block.children) })
      } else if (block.type === "quote") {
        walk(block.children)
      } else if (block.type === "list") {
        block.items.forEach(walk)
      }
    }
  }
  walk(blocks)
  return out
}
