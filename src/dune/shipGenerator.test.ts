import { generateShip } from "./shipGenerator"

test("is deterministic — same seed, identical output", () => {
  expect(generateShip("https://api.example/mcp")).toEqual(generateShip("https://api.example/mcp"))
})

test("different seeds produce different designs", () => {
  const seeds = ["https://a.example/mcp", "https://b.example/mcp", "https://c.example/mcp", "https://d.example/mcp"]
  const designs = seeds.map(generateShip)
  const distinctHulls = new Set(designs.map((d) => d.hullArchetype))
  const distinctColors = new Set(designs.map((d) => d.accentColors[0]))
  expect(distinctHulls.size + distinctColors.size).toBeGreaterThan(2)
})

test("fields are well-formed and in range", () => {
  const d = generateShip("https://demo.example/mcp")
  expect(["sleek", "blocky", "finned", "saucer", "spike"]).toContain(d.hullArchetype)
  expect(d.accentColors).toHaveLength(3)
  for (const c of [...d.accentColors, d.engineGlow]) {
    expect(c).toMatch(/^hsl\(\d+(\.\d+)? \d+% \d+%\)$/)
  }
  expect(d.finCount).toBeGreaterThanOrEqual(2)
  expect(d.finCount).toBeLessThanOrEqual(4)
  expect(d.greebles.length).toBeGreaterThanOrEqual(6)
  expect(d.greebles.length).toBeLessThanOrEqual(15)
  for (const g of d.greebles) {
    expect(Number.isFinite(g.x)).toBe(true)
    expect(Number.isFinite(g.y)).toBe(true)
  }
})

test("empty string seed does not throw and is still deterministic", () => {
  expect(generateShip("")).toEqual(generateShip(""))
})
