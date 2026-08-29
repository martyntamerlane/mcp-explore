import { formatPromptMessages, formatReadError, formatResourceContents } from "./readResult"
import { MAX_RESULT_BLOCKS, MAX_RESULT_CHARS } from "./runResult"

test("resource text contents pass through; JSON pretty-prints", () => {
  const d = formatResourceContents({
    contents: [
      { uri: "d://a", mimeType: "text/plain", text: "hello" },
      { uri: "d://b", mimeType: "application/json", text: '{"a":1}' },
    ],
  })
  expect(d.ok).toBe(true)
  expect(d.blocks[0]).toEqual({ text: "hello", mime: "text/plain" })
  expect(d.blocks[1].text).toBe('{\n  "a": 1\n}')
  expect(d.truncated).toBe(false)
})

test("the server's declared mime rides along, so the render layer need not guess", () => {
  const d = formatResourceContents({
    contents: [
      { uri: "d://doc", mimeType: "text/markdown", text: "plain words, no markup" },
      { uri: "d://bare", text: "no mime given" },
    ],
  })
  expect(d.blocks[0].mime).toBe("text/markdown")
  expect(d.blocks[1].mime).toBeUndefined()
})

test("image blobs become image blocks with a data URI; other blobs an honest note", () => {
  const d = formatResourceContents({
    contents: [
      { uri: "d://pic", mimeType: "image/png", blob: "aGk=" },
      { uri: "d://bin", mimeType: "application/zip", blob: "aGk=" },
      { uri: "d://mystery", blob: "aGk=" },
    ],
  })
  expect(d.blocks[0].image).toEqual({ src: "data:image/png;base64,aGk=", alt: "d://pic" })
  expect(d.blocks[1].text).toBe("(binary application/zip — not rendered)")
  expect(d.blocks[2].text).toBe("(binary unknown type — not rendered)")
})

test("malformed resource results are honest, never a throw", () => {
  for (const bad of [null, 42, {}, { contents: "nope" }]) {
    const d = formatResourceContents(bad)
    expect(d.ok).toBe(false)
    expect(d.blocks[0].text).toMatch(/could not be displayed/)
  }
})

test("resource text is capped with truncated flag", () => {
  const d = formatResourceContents({ contents: [{ uri: "d://big", text: "x".repeat(MAX_RESULT_CHARS + 10_000) }] })
  expect(d.blocks[0].text).toHaveLength(MAX_RESULT_CHARS)
  expect(d.truncated).toBe(true)
})

test("a content-item flood is capped at MAX_RESULT_BLOCKS", () => {
  const d = formatResourceContents({
    contents: Array.from({ length: MAX_RESULT_BLOCKS + 5 }, (_, i) => ({ uri: `d://${i}`, text: "t" })),
  })
  expect(d.blocks.length).toBeLessThanOrEqual(MAX_RESULT_BLOCKS + 1)
  expect(d.blocks.at(-1)?.text).toBe("(+ 5 more content items not shown)")
  expect(d.truncated).toBe(true)
})

test("prompt messages label by role and render text content", () => {
  const d = formatPromptMessages({
    messages: [
      { role: "user", content: { type: "text", text: "Summarise the week." } },
      { role: "assistant", content: { type: "image", data: "x", mimeType: "image/png" } },
    ],
  })
  expect(d.ok).toBe(true)
  expect(d.blocks[0]).toEqual({ label: "user", text: "Summarise the week." })
  expect(d.blocks[1]).toEqual({ label: "assistant", text: "(image content — not rendered)" })
})

test("malformed prompt results are honest, never a throw", () => {
  for (const bad of [null, {}, { messages: "nope" }, { messages: [null, 7] }]) {
    const d = formatPromptMessages(bad)
    expect(d.ok).toBe(false)
  }
})

test("formatReadError reduces to a plain message", () => {
  expect(formatReadError(new Error("boom"))).toEqual({ ok: false, blocks: [{ text: "boom" }], truncated: false })
  expect(formatReadError("nope").blocks[0].text).toBe("nope")
})
