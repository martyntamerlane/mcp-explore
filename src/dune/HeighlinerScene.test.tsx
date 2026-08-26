import { render, screen, within } from "@testing-library/react"
import HeighlinerScene from "./HeighlinerScene"

test("renders the heighliner, the central entity, and all ten orbit tiles", () => {
  render(<HeighlinerScene transitioning={false} shipSeed="https://a.example/mcp" />)
  expect(screen.getByLabelText(/heighliner/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/galactic entity/i)).toBeInTheDocument()
  expect(screen.getAllByRole("img", { name: /generative art/i, hidden: true })).toHaveLength(10)
})

test("the ship is hidden until transitioning", () => {
  const { rerender, container } = render(<HeighlinerScene transitioning={false} shipSeed="https://a.example/mcp" />)
  expect(container.querySelector('[data-departing="true"]')).not.toBeInTheDocument()
  rerender(<HeighlinerScene transitioning shipSeed="https://a.example/mcp" />)
  expect(container.querySelector('[data-departing="true"]')).toBeInTheDocument()
})

test("the same seed always renders the same ship archetype", () => {
  const a = render(<HeighlinerScene transitioning shipSeed="https://same.example/mcp" />)
  const b = render(<HeighlinerScene transitioning shipSeed="https://same.example/mcp" />)
  // Scoped with within(container): render() binds its queries to document.body by default, and
  // with two renders live at once (no unmount between them) an unscoped a.getByRole/b.getByRole
  // would match both ships and throw "Found multiple elements".
  // { hidden: true }: the ship lives inside the scene's aria-hidden="true" wrapper (it's
  // decorative background chrome — see Fix 5), which getByRole excludes by default.
  expect(within(a.container).getByRole("img", { name: /ship$/i, hidden: true }).getAttribute("aria-label")).toBe(
    within(b.container).getByRole("img", { name: /ship$/i, hidden: true }).getAttribute("aria-label"),
  )
})
