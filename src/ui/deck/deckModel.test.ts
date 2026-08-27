import type { ServerSnapshot } from "../../mcp/types"
import { buildDeckModel, classifyTool, requiredArgCount } from "./deckModel"

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

test("classify: zero-required + readOnlyHint => instant; zero-required => arm; required args => input-required", () => {
  expect(classifyTool(tool("a", { annotations: { readOnlyHint: true } }), "streamable-http")).toBe("instant")
  expect(classifyTool(tool("b"), "streamable-http")).toBe("arm")
  expect(classifyTool(tool("c", { inputSchema: { type: "object", required: ["x"] } }), "streamable-http")).toBe(
    "input-required",
  )
})

test("classify: every demo (in-memory) tool is runnable", () => {
  expect(classifyTool(tool("c", { inputSchema: { type: "object", required: ["x"] } }), "in-memory")).toBe("arm")
})

test("buildDeckModel groups rail with canonical glosses and dedupes duplicate ids", () => {
  const m = buildDeckModel(
    {
      ...base,
      tools: [tool("t1"), tool("t1")],
      resources: [
        { uri: "r://1", name: "one" },
        { uri: "r://1", name: "one again" },
      ],
      prompts: [{ name: "p1", description: "line1\nline2" }],
    },
    "in-memory",
  )
  expect(m.tools.map((t) => t.id)).toEqual(["t1"])
  expect(m.rail[0].items.map((i) => i.id)).toEqual(["r://1"])
  expect(m.rail[0].gloss).toBe("data it exposes")
  expect(m.rail[1].gloss).toBe("ready-made instructions")
  expect(m.rail[1].items[0].blurb).toBe("line1")
})

test("resource blurb falls back to its URI", () => {
  const m = buildDeckModel({ ...base, resources: [{ uri: "r://bare", name: "bare" }] }, "in-memory")
  expect(m.rail[0].items[0].blurb).toBe("r://bare")
})

test("emphasis flips to tool-light at <= 4 tools", () => {
  expect(buildDeckModel({ ...base, tools: [tool("a")] }, "in-memory").emphasis).toBe("tool-light")
  expect(buildDeckModel({ ...base, tools: [1, 2, 3, 4, 5].map((n) => tool("t" + n)) }, "in-memory").emphasis).toBe(
    "regular",
  )
})
