import { MAX_RESULT_CHARS, formatCallResult, formatRunError } from "./runResult"

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

test("formatRunError wraps thrown errors", () => {
  expect(formatRunError(new Error("boom"))).toEqual({ ok: false, blocks: [{ text: "boom" }], truncated: false })
  expect(formatRunError("weird")).toEqual({ ok: false, blocks: [{ text: "weird" }], truncated: false })
})
