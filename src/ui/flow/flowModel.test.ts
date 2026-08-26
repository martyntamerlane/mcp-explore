import { describe, expect, test } from "vitest"
import type { ServerSnapshot } from "../../mcp/types"
import { buildFlowModel, WIDE_PILL_MAX } from "./flowModel"

const base: ServerSnapshot = {
  serverInfo: { name: "s", version: "1" },
  capabilities: {},
  tools: [],
  resources: [],
  prompts: [],
}

const tool = (name: string, description?: string) => ({ name, description, inputSchema: { type: "object" as const } })

describe("buildFlowModel", () => {
  test("always emits the three groups in tool/resource/prompt order with canonical labels and glosses", () => {
    const m = buildFlowModel(base)
    expect(m.groups.map((g) => g.kind)).toEqual(["tool", "resource", "prompt"])
    expect(m.groups.map((g) => g.label)).toEqual(["Tools", "Resources", "Prompts"])
    expect(m.groups.map((g) => g.gloss)).toEqual([
      "actions it can perform",
      "data it exposes",
      "ready-made instructions",
    ])
  })

  test("clusters at or under the threshold are wide; above it, compact", () => {
    const wide = buildFlowModel({ ...base, tools: Array.from({ length: WIDE_PILL_MAX }, (_, i) => tool(`t${i}`)) })
    expect(wide.groups[0].density).toBe("wide")
    const compact = buildFlowModel({ ...base, tools: Array.from({ length: WIDE_PILL_MAX + 1 }, (_, i) => tool(`t${i}`)) })
    expect(compact.groups[0].density).toBe("compact")
  })

  test("density is per-cluster, not global", () => {
    const m = buildFlowModel({
      ...base,
      tools: Array.from({ length: 20 }, (_, i) => tool(`t${i}`)),
      prompts: [{ name: "p1" }],
    })
    expect(m.groups[0].density).toBe("compact")
    expect(m.groups[2].density).toBe("wide")
  })

  test("blurb is the first non-empty line of the description", () => {
    const m = buildFlowModel({ ...base, tools: [tool("a", "\n  First line.\nSecond line.")] })
    expect(m.groups[0].items[0].blurb).toBe("First line.")
  })

  test("missing descriptions yield undefined blurb", () => {
    const m = buildFlowModel({ ...base, tools: [tool("a")] })
    expect(m.groups[0].items[0].blurb).toBeUndefined()
  })

  test("resources use uri as id and name as label; blurb falls back to uri when undescribed", () => {
    const m = buildFlowModel({
      ...base,
      resources: [
        { uri: "file:///a.json", name: "Config", description: "The config." },
        { uri: "file:///b.md", name: "Readme" },
      ],
    })
    const [a, b] = m.groups[1].items
    expect(a).toMatchObject({ id: "file:///a.json", label: "Config", blurb: "The config." })
    expect(b).toMatchObject({ id: "file:///b.md", label: "Readme", blurb: "file:///b.md" })
  })

  test("is deterministic", () => {
    const snap = { ...base, tools: [tool("x", "d")] }
    expect(buildFlowModel(snap)).toEqual(buildFlowModel(snap))
  })
})
