import type { ServerSnapshot } from "../mcp/types"
import { parseSelection, readParams, resolveSelection, sameSelection, selectionParams } from "./selectionUrl"

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

test("the parameter string round-trips a selection", () => {
  const sel = { kind: "resource" as const, id: "hf://models/meta/Llama 3" }
  const params = selectionParams("https://huggingface.co/mcp", sel)
  expect(params).toBe("server=https%3A%2F%2Fhuggingface.co%2Fmcp&resource=hf%3A%2F%2Fmodels%2Fmeta%2FLlama%203")
  expect(parseSelection(params)).toEqual(sel)
})

test("the parameters carry no sigil — the caller picks # or ?", () => {
  expect(selectionParams("https://w.example/mcp", null)).toBe("server=https%3A%2F%2Fw.example%2Fmcp")
  expect(selectionParams(undefined, null)).toBe("")
  // The demo server has no URL, but a selection in it is still addressable.
  expect(selectionParams(undefined, { kind: "tool", id: "a" })).toBe("tool=a")
})

/**
 * The fragment is where selection lives now (TODO-31): a query string is sent to
 * GitHub Pages in the request for the document itself, so a shared `?server=`
 * link handed the address of someone's MCP server to our host. A fragment is
 * never transmitted. `?server=` is still read, forever, for links already shared.
 */
test("the fragment wins when it names a selection, and comes back without its sigil", () => {
  // Bare parameters, symmetric with selectionParams. `URLSearchParams` strips a
  // leading `?` but *not* a leading `#`, so returning `#tool=t` would parse as a
  // key literally named `#tool` — the sigil has to come off here.
  expect(readParams({ hash: "#server=a&tool=t", search: "" })).toBe("server=a&tool=t")
  // A demo-server selection has no `server` at all, and must still win.
  expect(readParams({ hash: "#tool=t", search: "" })).toBe("tool=t")
  expect(readParams({ hash: "#resource=r", search: "?server=stale" })).toBe("resource=r")
})

test("a legacy ?server= link still reads, and an in-page anchor never shadows it", () => {
  expect(readParams({ hash: "", search: "?server=a&tool=t" })).toBe("server=a&tool=t")
  // The result outline's hrefs are heading slugs (Outline.tsx). One of those in
  // the address bar must not be mistaken for a selection that shadows the query.
  expect(readParams({ hash: "#how-does-it-work", search: "?server=a" })).toBe("server=a")
  // A slug that happens to be one of our own key names has no value, so it is
  // not a selection either.
  expect(readParams({ hash: "#server", search: "?server=a" })).toBe("server=a")
  expect(readParams({ hash: "#tool=", search: "?server=a" })).toBe("server=a")
})

test("what readParams returns is what parseSelection accepts", () => {
  expect(parseSelection(readParams({ hash: "#tool=t", search: "" }))).toEqual({ kind: "tool", id: "t" })
  expect(parseSelection(readParams({ hash: "", search: "?prompt=p" }))).toEqual({ kind: "prompt", id: "p" })
})

test("nothing anywhere reads as nothing", () => {
  expect(readParams({ hash: "", search: "" })).toBe("")
  expect(readParams({ hash: "#", search: "" })).toBe("")
  expect(readParams({ hash: "", search: "?" })).toBe("")
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
