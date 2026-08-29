import { looksLikeMarkdown } from "./detect"

// False positives are the expensive failure here: mangling a server's plain
// output is worse than leaving markdown unrendered. Most of these guard that.

test("a declared markdown mime is believed", () => {
  expect(looksLikeMarkdown("just some words", "text/markdown")).toBe(true)
  expect(looksLikeMarkdown("just some words", "text/markdown; charset=utf-8")).toBe(true)
})

test("a declared non-markdown mime vetoes the heuristic", () => {
  expect(looksLikeMarkdown("# Heading\n\nbody", "text/plain")).toBe(false)
  expect(looksLikeMarkdown("# Heading\n\nbody", "application/json")).toBe(false)
})

test("structural signals are conclusive on their own", () => {
  expect(looksLikeMarkdown("# Title\n\nSome prose.")).toBe(true)
  expect(looksLikeMarkdown("Run this:\n\n```sh\nnpm i\n```")).toBe(true)
  expect(looksLikeMarkdown("- one\n- two")).toBe(true)
  expect(looksLikeMarkdown("1. one\n2. two")).toBe(true)
})

test("a single bullet is not a list", () => {
  expect(looksLikeMarkdown("Config parsed - no errors found in the file.")).toBe(false)
})

test("plain prose and logs are left alone", () => {
  expect(looksLikeMarkdown("Created issue #104: Untitled issue")).toBe(false)
  expect(looksLikeMarkdown("2026-08-29 10:14:02 INFO  worker started (pid 8123)")).toBe(false)
  expect(looksLikeMarkdown("The rate is 3 * 4 * 5 per second.")).toBe(false)
  expect(looksLikeMarkdown("Use the search_issues tool with a query_string argument.")).toBe(false)
})

test("one weak signal alone is not enough", () => {
  expect(looksLikeMarkdown("See the `config` value.")).toBe(false)
  expect(looksLikeMarkdown("A **strong** claim.")).toBe(false)
})

test("two weak signals together are", () => {
  expect(looksLikeMarkdown("A **strong** claim about `config`, and `more`.")).toBe(true)
  expect(looksLikeMarkdown("See [the docs](https://example.com) for **details**.")).toBe(true)
})

test("a GFM table is recognised", () => {
  expect(looksLikeMarkdown("| a | b |\n| --- | --- |\n| 1 | 2 |")).toBe(true)
})

test("JSON is never markdown, however many asterisks it contains", () => {
  expect(looksLikeMarkdown('{\n  "glob": "**/*.ts",\n  "note": "a **bold** claim"\n}')).toBe(false)
  expect(looksLikeMarkdown('[\n  "- one",\n  "- two"\n]')).toBe(false)
})

test("text that merely starts with a brace is still assessed", () => {
  expect(looksLikeMarkdown("{not json at all\n\n# But a heading")).toBe(true)
})

test("trivial strings are never markdown", () => {
  expect(looksLikeMarkdown("")).toBe(false)
  expect(looksLikeMarkdown("ok")).toBe(false)
})
