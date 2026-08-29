import type { ServerSnapshot } from "../mcp/types"
import { parseSelection, resolveSelection, sameSelection, selectionSearch } from "./selectionUrl"

const snapshot = {
  serverInfo: { name: "s", version: "1" },
  capabilities: {},
  tools: [{ name: "ask_question", inputSchema: { type: "object" as const } }],
  resources: [{ uri: "hf://models/meta/Llama 3", name: "Llama 3" }],
  prompts: [{ name: "triage" }],
} as unknown as ServerSnapshot

test("one kind parameter names the selection", () => {
  expect(parseSelection("?server=x&tool=ask_question")).toEqual({ kind: "tool", id: "ask_question" })
  expect(parseSelection("?resource=demo%3A%2F%2Fconfig")).toEqual({ kind: "resource", id: "demo://config" })
  expect(parseSelection("?prompt=triage")).toEqual({ kind: "prompt", id: "triage" })
})

test("no kind, an empty kind, or two kinds at once all read as home", () => {
  expect(parseSelection("?server=x")).toBeNull()
  expect(parseSelection("")).toBeNull()
  expect(parseSelection("?tool=")).toBeNull()
  // Two subjects have no honest reading, so the link opens the server itself.
  expect(parseSelection("?tool=a&resource=b")).toBeNull()
})

test("the search string round-trips a selection", () => {
  const sel = { kind: "resource" as const, id: "hf://models/meta/Llama 3" }
  const search = selectionSearch("https://huggingface.co/mcp", sel)
  expect(search).toBe("?server=https%3A%2F%2Fhuggingface.co%2Fmcp&resource=hf%3A%2F%2Fmodels%2Fmeta%2FLlama%203")
  expect(parseSelection(search)).toEqual(sel)
})

test("the server-only and empty forms are unchanged from before selections existed", () => {
  expect(selectionSearch("https://w.example/mcp", null)).toBe("?server=https%3A%2F%2Fw.example%2Fmcp")
  expect(selectionSearch(undefined, null)).toBe("")
  // The demo server has no URL, but a selection in it is still addressable.
  expect(selectionSearch(undefined, { kind: "tool", id: "a" })).toBe("?tool=a")
})

test("a selection the server does not expose resolves to home", () => {
  expect(resolveSelection({ kind: "tool", id: "ask_question" }, snapshot)).toEqual({
    kind: "tool",
    id: "ask_question",
  })
  expect(resolveSelection({ kind: "tool", id: "gone" }, snapshot)).toBeNull()
  // Resources are addressed by URI, not by name.
  expect(resolveSelection({ kind: "resource", id: "hf://models/meta/Llama 3" }, snapshot)).not.toBeNull()
  expect(resolveSelection({ kind: "resource", id: "Llama 3" }, snapshot)).toBeNull()
  expect(resolveSelection({ kind: "prompt", id: "triage" }, snapshot)).not.toBeNull()
  expect(resolveSelection(null, snapshot)).toBeNull()
})

test("sameSelection compares by value, and null is a value", () => {
  expect(sameSelection(null, null)).toBe(true)
  expect(sameSelection({ kind: "tool", id: "a" }, { kind: "tool", id: "a" })).toBe(true)
  expect(sameSelection({ kind: "tool", id: "a" }, { kind: "prompt", id: "a" })).toBe(false)
  expect(sameSelection({ kind: "tool", id: "a" }, null)).toBe(false)
})
