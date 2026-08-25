import { computeLayout, type LayoutInput } from "./layout"

const small: LayoutInput = {
  tools: [{ name: "a" }, { name: "b" }],
  resources: [{ uri: "demo://x" }],
  prompts: [{ name: "p" }],
}

test("is deterministic — same input, identical output", () => {
  expect(computeLayout(small)).toEqual(computeLayout(small))
})

test("places the server at the origin and three hubs at fixed angles", () => {
  const l = computeLayout(small)
  expect(l.server).toEqual({ x: 0, y: 0 })
  expect(l.hubs.map((h) => h.kind)).toEqual(["tool", "resource", "prompt"])
  const tool = l.hubs[0]
  // tool hub at -90° radius 190 → (0, -190)
  expect(tool.x).toBeCloseTo(0, 6)
  expect(tool.y).toBeCloseTo(-190, 6)
  expect(tool.count).toBe(2)
})

test("produces one leaf per item with kind, id and label", () => {
  const l = computeLayout(small)
  expect(l.leaves).toHaveLength(4)
  expect(l.leaves.filter((n) => n.kind === "tool").map((n) => n.id)).toEqual(["a", "b"])
  const res = l.leaves.find((n) => n.kind === "resource")!
  expect(res.id).toBe("demo://x")
  expect(res.label).toBe("demo://x")
})

test("resources use name as label when present", () => {
  const l = computeLayout({ ...small, resources: [{ uri: "demo://x", name: "Config" }] })
  expect(l.leaves.find((n) => n.kind === "resource")!.label).toBe("Config")
})

test("overflows onto additional rings and every coordinate is finite", () => {
  const many = { ...small, tools: Array.from({ length: 40 }, (_, i) => ({ name: `t${i}` })) }
  const l = computeLayout(many)
  expect(l.leaves.filter((n) => n.kind === "tool")).toHaveLength(40)
  const toolHub = l.hubs[0]
  const dists = l.leaves
    .filter((n) => n.kind === "tool")
    .map((n) => Math.hypot(n.x - toolHub.x, n.y - toolHub.y))
  // ring radii are 120, 176, 232… — 40 nodes need at least 3 rings (capacities 6, 9, 12, 15)
  expect(new Set(dists.map((d) => Math.round(d))).size).toBeGreaterThanOrEqual(3)
  for (const n of l.leaves) {
    expect(Number.isFinite(n.x)).toBe(true)
    expect(Number.isFinite(n.y)).toBe(true)
  }
})

test("viewBox bounds contain every node with padding", () => {
  const l = computeLayout(small)
  const all = [l.server, ...l.hubs, ...l.leaves]
  for (const p of all) {
    expect(p.x).toBeGreaterThan(l.viewBox.x)
    expect(p.x).toBeLessThan(l.viewBox.x + l.viewBox.width)
    expect(p.y).toBeGreaterThan(l.viewBox.y)
    expect(p.y).toBeLessThan(l.viewBox.y + l.viewBox.height)
  }
})

test("an empty category still yields a hub with count 0 and no leaves", () => {
  const l = computeLayout({ tools: [], resources: [], prompts: [{ name: "p" }] })
  expect(l.hubs[0].count).toBe(0)
  expect(l.leaves).toHaveLength(1)
})
