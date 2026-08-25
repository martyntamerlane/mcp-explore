import { render } from "@testing-library/react"
import ShipSvg from "./ShipSvg"
import type { ShipDesign } from "./shipGenerator"

const design: ShipDesign = {
  hullArchetype: "finned",
  accentColors: ["hsl(32 55% 45%)", "hsl(52 50% 60%)", "hsl(12 40% 30%)"],
  engineGlow: "hsl(212 80% 65%)",
  greebles: [
    { x: -10, y: 2 },
    { x: 5, y: -4 },
    { x: 20, y: 6 },
  ],
  finCount: 3,
}

test("renders one line per fin and one rect per greeble", () => {
  const { container } = render(<ShipSvg design={design} />)
  expect(container.querySelectorAll("line")).toHaveLength(3)
  expect(container.querySelectorAll("rect")).toHaveLength(3)
})

test("engine glow circle uses the design's engineGlow color", () => {
  const { container } = render(<ShipSvg design={design} />)
  const engine = container.querySelector("circle")
  expect(engine).toHaveAttribute("fill", design.engineGlow)
})

test("labels the ship for accessibility", () => {
  const { getByRole } = render(<ShipSvg design={design} />)
  expect(getByRole("img", { name: /finned ship/i })).toBeInTheDocument()
})
