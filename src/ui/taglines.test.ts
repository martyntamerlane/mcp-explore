import { pickTagline, TAGLINES } from "./taglines"

test("picks by index across the whole list, never off the end", () => {
  expect(pickTagline(() => 0)).toBe(TAGLINES[0])
  expect(pickTagline(() => 0.999999)).toBe(TAGLINES[TAGLINES.length - 1])
  expect(TAGLINES).toContain("See inside any MCP server.")
})
