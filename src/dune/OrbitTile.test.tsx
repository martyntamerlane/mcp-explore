import { render } from "@testing-library/react"
import OrbitTile from "./OrbitTile"

test("renders a distinct motif for each of the 10 orbit indices", () => {
  const motifs = new Set<string | null>()
  for (let i = 0; i < 10; i++) {
    const { container, unmount } = render(<OrbitTile index={i} />)
    motifs.add(container.querySelector("svg")?.getAttribute("data-motif") ?? null)
    unmount()
  }
  // 5 motifs across 10 tiles — every motif must appear, none is empty
  expect(motifs.has(null)).toBe(false)
  expect(motifs.size).toBe(5)
})

test("is deterministic for a given index", () => {
  const a = render(<OrbitTile index={3} />).container.innerHTML
  const b = render(<OrbitTile index={3} />).container.innerHTML
  expect(a).toBe(b)
})

test("two different indices with the same motif still render different hues", () => {
  // indices 0 and 5 share the "storm" motif (5 motifs, 10 tiles)
  const zero = render(<OrbitTile index={0} />).container.querySelector("svg")!
  const five = render(<OrbitTile index={5} />).container.querySelector("svg")!
  expect(zero.getAttribute("data-motif")).toBe(five.getAttribute("data-motif"))
  expect(zero.innerHTML).not.toBe(five.innerHTML)
})
