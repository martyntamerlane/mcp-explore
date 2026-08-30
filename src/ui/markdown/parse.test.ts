import { parseBlocks, parseInline, safeHref, type Block, type Inline } from "./parse"

/** Flatten a tree back to its visible text, which is what the reader sees. */
function textOf(nodes: Inline[]): string {
  return nodes
    .map((n) => {
      switch (n.type) {
        case "text":
        case "code":
          return n.value
        case "image":
          return n.alt
        default:
          return textOf(n.children)
      }
    })
    .join("")
}

// ── links: the security-relevant half ────────────────────────────────

test("safeHref passes http, https and mailto", () => {
  expect(safeHref("https://example.com/a-b_c?d=1")).toBe("https://example.com/a-b_c?d=1")
  expect(safeHref("http://example.com")).toBe("http://example.com")
  expect(safeHref("mailto:someone@example.com")).toBe("mailto:someone@example.com")
})

test("safeHref rejects every other scheme, and relative and protocol-relative URLs", () => {
  expect(safeHref("javascript:alert(1)")).toBeNull()
  expect(safeHref("JavaScript:alert(1)")).toBeNull()
  expect(safeHref("data:text/html,<script>alert(1)</script>")).toBeNull()
  expect(safeHref("vbscript:msgbox(1)")).toBeNull()
  expect(safeHref("//evil.example.com")).toBeNull()
  expect(safeHref("/admin")).toBeNull()
  expect(safeHref("../secrets")).toBeNull()
  expect(safeHref("")).toBeNull()
})

test("a link with an unsafe target renders as its text, with no link at all", () => {
  const nodes = parseInline("click [here](javascript:alert(1)) now")
  expect(nodes.some((n) => n.type === "link")).toBe(false)
  expect(textOf(nodes)).toBe("click here now")
})

test("images never become images — only a link, or inert text", () => {
  const remote = parseInline("![a cat](https://example.com/cat.png)")
  expect(remote[0]).toEqual({ type: "image", href: "https://example.com/cat.png", alt: "a cat" })

  const unsafe = parseInline("![x](javascript:alert(1))")
  expect(unsafe[0]).toEqual({ type: "image", href: null, alt: "x" })
})

test("autolinks and bare URLs are linked", () => {
  expect(parseInline("<https://example.com>")[0]).toMatchObject({ type: "link", href: "https://example.com" })
  expect(parseInline("see https://example.com/x for more")[1]).toMatchObject({
    type: "link",
    href: "https://example.com/x",
  })
})

// ── inline ───────────────────────────────────────────────────────────

test("bold, italic, strikethrough and code", () => {
  expect(parseInline("**b**")[0]).toMatchObject({ type: "strong" })
  expect(parseInline("*i*")[0]).toMatchObject({ type: "em" })
  expect(parseInline("~~d~~")[0]).toMatchObject({ type: "del" })
  expect(parseInline("`c`")[0]).toEqual({ type: "code", value: "c" })
})

test("underscores inside identifiers are left alone", () => {
  const nodes = parseInline("call search_issues and list_issues_by_label")
  expect(nodes.every((n) => n.type === "text")).toBe(true)
  expect(textOf(nodes)).toBe("call search_issues and list_issues_by_label")
})

test("a code span is not re-parsed as markdown", () => {
  const nodes = parseInline("use `**not bold**` here")
  expect(nodes[1]).toEqual({ type: "code", value: "**not bold**" })
})

test("backslash escapes suppress markup", () => {
  expect(textOf(parseInline("\\*not italic\\*"))).toBe("*not italic*")
})

test("an unmatched marker stays literal", () => {
  expect(textOf(parseInline("2 * 3 * 4 = 24"))).toBe("2 * 3 * 4 = 24")
  expect(textOf(parseInline("**unclosed"))).toBe("**unclosed")
})

// ── blocks ───────────────────────────────────────────────────────────

test("headings start at h3 so they sit under the workspace's h2", () => {
  const blocks = parseBlocks("# One\n## Two\n###### Six")
  expect(blocks.map((b) => (b as { level: number }).level)).toEqual([3, 4, 6])
})

test("fenced code keeps its content verbatim, with its language", () => {
  const blocks = parseBlocks("```ts\nconst a = **1**\n```")
  expect(blocks[0]).toEqual({ type: "code", lang: "ts", value: "const a = **1**" })
})

test("an unclosed fence still yields a code block", () => {
  expect(parseBlocks("```\nabc")[0]).toMatchObject({ type: "code", value: "abc" })
})

test("bullet and ordered lists, with the ordered start preserved", () => {
  const ul = parseBlocks("- a\n- b")[0] as Extract<Block, { type: "list" }>
  expect(ul.ordered).toBe(false)
  expect(ul.items).toHaveLength(2)

  const ol = parseBlocks("3. c\n4. d")[0] as Extract<Block, { type: "list" }>
  expect(ol.ordered).toBe(true)
  expect(ol.start).toBe(3)
})

test("nested lists", () => {
  const list = parseBlocks("- outer\n  - inner")[0] as Extract<Block, { type: "list" }>
  const nested = list.items[0][1] as Extract<Block, { type: "list" }>
  expect(nested.type).toBe("list")
  expect(textOf((nested.items[0][0] as Extract<Block, { type: "paragraph" }>).children)).toBe("inner")
})

test("blockquotes parse their contents as blocks", () => {
  const quote = parseBlocks("> # inner heading")[0] as Extract<Block, { type: "quote" }>
  expect(quote.children[0]).toMatchObject({ type: "heading", level: 3 })
})

test("a GFM table, with alignment and ragged rows squared off", () => {
  const table = parseBlocks("| a | b |\n| :-- | --: |\n| 1 | 2 |\n| 3 |")[0] as Extract<Block, { type: "table" }>
  expect(table.align).toEqual(["left", "right"])
  expect(textOf(table.head[0])).toBe("a")
  expect(table.rows).toHaveLength(2)
  expect(table.rows[1]).toHaveLength(2)
  expect(textOf(table.rows[1][1])).toBe("")
})

test("thematic breaks", () => {
  expect(parseBlocks("---")[0]).toEqual({ type: "rule" })
  expect(parseBlocks("***")[0]).toEqual({ type: "rule" })
})

test("a heading interrupts a paragraph without a blank line", () => {
  const blocks = parseBlocks("some text\n# heading")
  expect(blocks.map((b) => b.type)).toEqual(["paragraph", "heading"])
})

test("deeply nested hostile input terminates and degrades to text", () => {
  const deep = ">".repeat(200) + " boom"
  expect(() => parseBlocks(deep)).not.toThrow()
  const wide = "*".repeat(2000)
  expect(() => parseInline(wide)).not.toThrow()
})

test("a realistic server response", () => {
  const blocks = parseBlocks(
    "# Results\n\nFound **2** issues in `demo/repo`:\n\n1. First one\n2. Second one\n\n> Note: capped at 2.\n",
  )
  expect(blocks.map((b) => b.type)).toEqual(["heading", "paragraph", "list", "quote"])
})

// ── block-level HTML (2026-08-29 reading pass) ───────────────────────

test("a line that is nothing but an HTML tag is dropped", () => {
  const blocks = parseBlocks("<details>\n\nreal text\n\n</details>")
  expect(blocks.map((b) => b.type)).toEqual(["paragraph"])
  expect(textOf((blocks[0] as Extract<Block, { type: "paragraph" }>).children)).toBe("real text")
})

test("a tag pair around text keeps the text and loses the tags", () => {
  const blocks = parseBlocks("<summary>Relevant source files</summary>")
  expect(blocks.map((b) => b.type)).toEqual(["paragraph"])
  expect(textOf((blocks[0] as Extract<Block, { type: "paragraph" }>).children)).toBe("Relevant source files")
})

test("the deepwiki opener renders as its text alone", () => {
  const blocks = parseBlocks("<details>\n<summary>Relevant source files</summary>\n\n- README.md\n\n</details>")
  expect(blocks.map((b) => b.type)).toEqual(["paragraph", "list"])
})

test("an HTML line interrupts a paragraph rather than joining it", () => {
  const blocks = parseBlocks("some text\n<details>")
  expect(blocks.map((b) => b.type)).toEqual(["paragraph"])
  expect(textOf((blocks[0] as Extract<Block, { type: "paragraph" }>).children)).toBe("some text")
})

test("prose that merely looks like a tag is left alone", () => {
  const blocks = parseBlocks("<not a tag>")
  expect(blocks.map((b) => b.type)).toEqual(["paragraph"])
  expect(textOf((blocks[0] as Extract<Block, { type: "paragraph" }>).children)).toBe("<not a tag>")
})

test("an empty tag pair produces no block at all", () => {
  expect(parseBlocks("<div></div>")).toEqual([])
})

test("tags with attributes are still recognised", () => {
  expect(parseBlocks('<div class="x">')).toEqual([])
  expect(parseBlocks("<br />")).toEqual([])
})

/* ── the scan budget (ISSUE-13) ── */

/**
 * `closingIndex` and `matchLink` scan to the end of the string when there is
 * nothing to find, and the caller then advances one character and asks again.
 * At the 50,000-character display cap that measured 4.9 s of blocked main
 * thread. These assert the ceiling, not a stopwatch reading: the threshold is
 * loose enough to survive a slow CI box and still fail by two orders of
 * magnitude if the quadratic behaviour ever comes back.
 */
const HOSTILE_BUDGET_MS = 500

test.each([
  ["unmatched strikethrough markers", "~~ "],
  ["unmatched emphasis markers", "** "],
  ["unopened link labels", "["],
])("50,000 characters of %s parse promptly", (_label, unit) => {
  const text = ("# Report\n\n" + unit.repeat(60000)).slice(0, 50_000)
  const started = performance.now()
  parseBlocks(text)
  expect(performance.now() - started).toBeLessThan(HOSTILE_BUDGET_MS)
})

test("real markdown is unaffected by the budget", () => {
  // The budget is proportional to the input, so a long legitimate document has
  // to keep parsing normally — a length cap would have sent this to a <pre>.
  const para = "Some **bold** and *italic* and `code` and a [link](https://example.test/a).\n"
  let doc = "# Title\n\n"
  for (let i = 0; doc.length < 50_000; i++) doc += `## Section ${i}\n\n${para.repeat(6)}\n- one\n- two\n\n`
  const blocks = parseBlocks(doc.slice(0, 50_000))

  const headings = blocks.filter((b) => b.type === "heading")
  expect(headings.length).toBeGreaterThan(20)
  // Emphasis and links still resolve rather than degrading to literal text.
  const paragraph = blocks.find((b) => b.type === "paragraph") as Extract<Block, { type: "paragraph" }>
  expect(paragraph.children.some((n) => n.type === "strong")).toBe(true)
  expect(paragraph.children.some((n) => n.type === "link")).toBe(true)
})

test("exhausting the budget degrades to text, never to markup", () => {
  // The failure mode must stay "the marker was literal", which is what an
  // unmatched marker already renders as. Nothing is dropped or invented.
  const text = "~~ ".repeat(20000)
  const blocks = parseBlocks(text)
  const flat = JSON.stringify(blocks)
  expect(flat).not.toContain('"type":"del"')
  expect(blocks.every((b) => b.type === "paragraph")).toBe(true)
})

test("the budget resets per document, so one hostile block cannot starve the next", () => {
  parseBlocks("[".repeat(20000))
  const blocks = parseBlocks("a [link](https://example.test/x) here")
  const paragraph = blocks[0] as Extract<Block, { type: "paragraph" }>
  expect(paragraph.children.some((n) => n.type === "link")).toBe(true)
})
