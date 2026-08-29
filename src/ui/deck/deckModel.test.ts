import type { ServerSnapshot } from "../../mcp/types"
import { buildDeckModel, isZeroArg, requiredArgCount } from "./deckModel"

const base: ServerSnapshot = {
  serverInfo: { name: "s", version: "1" },
  capabilities: {},
  tools: [],
  resources: [],
  prompts: [],
}
const tool = (name: string, extra: object = {}) => ({ name, inputSchema: { type: "object" as const }, ...extra })

test("requiredArgCount narrows untrusted schemas", () => {
  expect(requiredArgCount({ type: "object", required: ["a", "b"] })).toBe(2)
  expect(requiredArgCount({ type: "object" })).toBe(0)
  expect(requiredArgCount(null)).toBe(0)
  expect(requiredArgCount({ required: "not-an-array" })).toBe(0)
  expect(requiredArgCount({ required: [1, "x", null] })).toBe(1)
})

test("isZeroArg is about properties, not required — an all-optional tool still asks", () => {
  expect(isZeroArg(tool("none"))).toBe(true)
  expect(isZeroArg(tool("optional", { inputSchema: { type: "object", properties: { a: { type: "string" } } } }))).toBe(
    false,
  )
  expect(
    isZeroArg(
      tool("required", { inputSchema: { type: "object", properties: { a: { type: "string" } }, required: ["a"] } }),
    ),
  ).toBe(false)
})

test("readOnly comes only from the server's own annotation", () => {
  const m = buildDeckModel({
    ...base,
    tools: [tool("ro", { annotations: { readOnlyHint: true } }), tool("plain")],
  })
  expect(m.tools.map((t) => [t.id, t.readOnly])).toEqual([
    ["ro", true],
    ["plain", false],
  ])
})

test("buildDeckModel groups the browse kinds and dedupes duplicate ids", () => {
  const m = buildDeckModel({
    ...base,
    tools: [tool("t1"), tool("t1")],
    resources: [
      { uri: "r://1", name: "one" },
      { uri: "r://1", name: "one again" },
    ],
    prompts: [{ name: "p1", description: "line1\nline2" }],
  })
  expect(m.tools.map((t) => t.id)).toEqual(["t1"])
  expect(m.groups.map((g) => g.kind)).toEqual(["resource", "prompt"])
  expect(m.groups[0].items.map((i) => i.id)).toEqual(["r://1"])
  expect(m.groups[1].items[0].description).toBe("line1\nline2")
})

test("browse items carry what their workspace view needs — mime, args with required flags", () => {
  const m = buildDeckModel({
    ...base,
    resources: [{ uri: "r://cfg", name: "cfg", mimeType: "application/json" }],
    prompts: [
      { name: "p1", arguments: [{ name: "id", required: true, description: "which" }, { name: "tone" }] },
      { name: "p2" },
    ],
  })
  expect(m.groups[0].items[0].mimeType).toBe("application/json")
  expect(m.groups[1].items[0].promptArgs).toEqual([
    { name: "id", required: true, description: "which" },
    { name: "tone", required: false, description: undefined },
  ])
  expect(m.groups[1].items[1].promptArgs).toEqual([])
})

test("the tool blurb is the description's first non-empty line", () => {
  const m = buildDeckModel({ ...base, tools: [tool("t", { description: "\n  first line \nsecond" })] })
  expect(m.tools[0].blurb).toBe("first line")
})
