import { documentHeadings, inlineText, parseDocument, slugify } from "../markdown/parse"
import { MIN_HEADINGS, outlineOf, worthShowing } from "./resultOutline"

/* ── slugs from hostile headings ── */

test("a slug is lowercase, hyphenated, and stripped of everything else", () => {
  expect(slugify("Getting Started")).toBe("getting-started")
  expect(slugify("  What's *new*?  ")).toBe("what-s-new")
  expect(slugify("API / SDK — notes")).toBe("api-sdk-notes")
  expect(slugify("Section 2.1")).toBe("section-2-1")
})

test("a slug survives headings that have no sluggable characters", () => {
  expect(slugify("")).toBe("section")
  expect(slugify("🚀🚀🚀")).toBe("section")
  expect(slugify("!!! ??? ...")).toBe("section")
  expect(slugify("---")).toBe("section")
})

test("a slug keeps non-Latin letters rather than erasing the heading", () => {
  expect(slugify("Обзор")).toBe("обзор")
  expect(slugify("概要 2")).toBe("概要-2")
})

test("a 500-character heading is cut to a usable id with no trailing hyphen", () => {
  const long = slugify(("word ".repeat(100)).trim())
  expect(long.length).toBeLessThanOrEqual(60)
  expect(long.endsWith("-")).toBe(false)
  expect(long.startsWith("word-word")).toBe(true)
})

/* ── ids within a document ── */

test("duplicate headings get distinct ids, in document order", () => {
  const ids = documentHeadings(parseDocument("## Setup\n\n## Setup\n\n## Setup")).map((h) => h.id)
  expect(ids).toEqual(["setup", "setup-2", "setup-3"])
})

test("ids are prefixed so two blocks of one result cannot collide", () => {
  const a = documentHeadings(parseDocument("## Overview", "b0")).map((h) => h.id)
  const b = documentHeadings(parseDocument("## Overview", "b1")).map((h) => h.id)
  expect(a).toEqual(["b0-overview"])
  expect(b).toEqual(["b1-overview"])
})

test("an outline entry's label is the heading's text, markup removed", () => {
  const [entry] = documentHeadings(parseDocument("## The `Client` **class**"))
  expect(entry.text).toBe("The Client class")
  expect(entry.id).toBe("the-client-class")
  // Every heading is demoted two levels: the workspace's subject is the h2, so
  // a document's `#` renders as h3 and this `##` as h4.
  expect(entry.level).toBe(4)
})

test("inlineText flattens every inline kind, including a refused image", () => {
  const [block] = parseDocument("## a [b](https://x.test) ~~c~~ ![alt](javascript:alert(1))")
  expect(block.type).toBe("heading")
  expect(inlineText(block.type === "heading" ? block.children : [])).toBe("a b c alt")
})

/* ── whether an outline appears at all ── */

const md = (n: number) => Array.from({ length: n }, (_, i) => `## Heading ${i}\n\nbody text here\n`).join("\n")

test("an outline is built from every markdown block of a result", () => {
  const entries = outlineOf([{ text: md(2) }, { text: md(2) }])
  expect(entries.map((e) => e.id)).toEqual([
    "b0-heading-0",
    "b0-heading-1",
    "b1-heading-0",
    "b1-heading-1",
  ])
})

test("text that is not markdown contributes nothing", () => {
  expect(outlineOf([{ text: '{"a": 1}', mime: "application/json" }])).toEqual([])
  expect(outlineOf([{ text: "just a sentence." }])).toEqual([])
  expect(outlineOf([{}])).toEqual([])
})

test("a declared mime is honoured, so a markdown resource outlines", () => {
  const entries = outlineOf([{ text: md(3), mime: "text/markdown" }])
  expect(entries).toHaveLength(3)
})

test("an outline appears only once it has somewhere to take you", () => {
  expect(worthShowing(outlineOf([{ text: md(MIN_HEADINGS - 1) }]))).toBe(false)
  expect(worthShowing(outlineOf([{ text: md(MIN_HEADINGS) }]))).toBe(true)
})
