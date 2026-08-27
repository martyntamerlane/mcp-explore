import { MAX_RESULT_BLOCKS, MAX_RESULT_CHARS, formatCallResult, formatRunError } from "./runResult"

test("text content renders as blocks", () => {
  const d = formatCallResult({ content: [{ type: "text", text: "hello" }] })
  expect(d).toEqual({ ok: true, blocks: [{ text: "hello" }], truncated: false })
})

test("JSON-parseable text pretty-prints", () => {
  const d = formatCallResult({ content: [{ type: "text", text: '{"a":1}' }] })
  expect(d.blocks[0].text).toBe('{\n  "a": 1\n}')
})

test("isError flips ok", () => {
  const d = formatCallResult({ isError: true, content: [{ type: "text", text: "nope" }] })
  expect(d.ok).toBe(false)
  expect(d.blocks[0].text).toBe("nope")
})

test("non-text content renders a labeled placeholder, never raw data", () => {
  const d = formatCallResult({ content: [{ type: "image", data: "AAAA", mimeType: "image/png" }] })
  expect(d.blocks).toEqual([{ text: "(image content — not rendered)" }])
})

test("structuredContent pretty-prints as a labeled block", () => {
  const d = formatCallResult({ content: [], structuredContent: { n: 2 } })
  expect(d.blocks).toEqual([{ label: "structured", text: '{\n  "n": 2\n}' }])
})

test("malformed results yield an honest failure, not a throw", () => {
  for (const bad of [null, "what", { content: "nope" }]) {
    const d = formatCallResult(bad)
    expect(d.ok).toBe(false)
    expect(d.blocks[0].text).toMatch(/unrecognised result shape/i)
  }
})

test("oversized output is capped defensively", () => {
  const d = formatCallResult({ content: [{ type: "text", text: "x".repeat(MAX_RESULT_CHARS + 10_000) }] })
  expect(d.truncated).toBe(true)
  expect(d.blocks[0].text.length).toBe(MAX_RESULT_CHARS)
})

test("cap applies across blocks", () => {
  const half = "y".repeat(MAX_RESULT_CHARS - 5)
  const d = formatCallResult({
    content: [
      { type: "text", text: half },
      { type: "text", text: "z".repeat(100) },
    ],
  })
  expect(d.truncated).toBe(true)
  expect(d.blocks[1].text.length).toBe(5)
})

test("oversized text is never parsed/pretty-printed — sliced raw", () => {
  const giant = "[" + "1,".repeat(30_000) + "1]" // valid JSON, > MAX_RESULT_CHARS
  const d = formatCallResult({ content: [{ type: "text", text: giant }] })
  // pretty-printing would start "[\n  1," — raw slice proves we skipped the parse
  expect(d.blocks[0].text).toBe(giant.slice(0, MAX_RESULT_CHARS))
  expect(d.truncated).toBe(true)
})

test("block count is capped — a flood of items cannot DoS the panel", () => {
  const d = formatCallResult({ content: Array(MAX_RESULT_BLOCKS + 50).fill({ type: "text", text: "" }) })
  expect(d.blocks.length).toBe(MAX_RESULT_BLOCKS + 1)
  expect(d.blocks[MAX_RESULT_BLOCKS].text).toMatch(/\+ 50 more content items/)
  expect(d.truncated).toBe(true)
})

test("a structuredContent-only result (no content array) is accepted", () => {
  const d = formatCallResult({ structuredContent: { a: 1 } })
  expect(d.ok).toBe(true)
  expect(d.blocks).toEqual([{ label: "structured", text: '{\n  "a": 1\n}' }])
})

test("formatRunError wraps thrown errors", () => {
  expect(formatRunError(new Error("boom"))).toEqual({ ok: false, blocks: [{ text: "boom" }], truncated: false })
  expect(formatRunError("weird")).toEqual({ ok: false, blocks: [{ text: "weird" }], truncated: false })
})
