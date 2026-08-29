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
  expect(container.querySelectorAll("[data-stars] i")).toHaveLength(212)
})

test("renders muted city lights, all placed on the planet surface below the limb", () => {
  const { container } = render(<CinematicScene />)
  const lights = container.querySelectorAll<HTMLElement>("[data-cities] i")
  expect(lights.length).toBeGreaterThanOrEqual(40)
  for (const light of lights) {
    const left = parseFloat(light.style.left)
    const top = parseFloat(light.style.top)
    // The hero image's limb is an arc, y ≈ -0.0312x² + 0.461x + 92.4 (vh per vw,
    // fitted at 16:9 cover); the surface is below it. A light above that arc
    // would float in open space.
    expect(top).toBeGreaterThan(-0.0312 * left * left + 0.461 * left + 92.4)
  }
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
