import { render } from "@testing-library/react"
import CinematicScene from "./CinematicScene"

test("renders the hero backdrop image and its bloom duplicate", () => {
  const { container } = render(<CinematicScene />)
  const images = container.querySelectorAll("img")
  expect(images).toHaveLength(2)
  for (const img of images) {
    expect(img.getAttribute("src")).toBeTruthy()
    expect(img).toHaveAttribute("alt", "")
  }
})

test("the scene is decorative — hidden from assistive tech", () => {
  const { container } = render(<CinematicScene />)
  const root = container.firstElementChild
  expect(root).toHaveAttribute("aria-hidden", "true")
})

test("star field is deterministic — two renders produce identical markup", () => {
  const a = render(<CinematicScene />).container.innerHTML
  const b = render(<CinematicScene />).container.innerHTML
  expect(a).toBe(b)
})

test("renders the full star field", () => {
  const { container } = render(<CinematicScene />)
  // 200 field stars + 12 bright blooming stars
  expect(container.querySelectorAll("i")).toHaveLength(212)
})

test("unmounting removes its document-level pointermove listener", () => {
  const addSpy = vi.spyOn(window, "addEventListener")
  const removeSpy = vi.spyOn(window, "removeEventListener")
  const { unmount } = render(<CinematicScene />)
  unmount()
  const added = addSpy.mock.calls.filter(([type]) => type === "pointermove").length
  const removed = removeSpy.mock.calls.filter(([type]) => type === "pointermove").length
  expect(added).toBeGreaterThan(0)
  expect(removed).toBe(added)
  addSpy.mockRestore()
  removeSpy.mockRestore()
})
