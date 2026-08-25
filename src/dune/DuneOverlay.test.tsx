import { act, render, screen } from "@testing-library/react"
import DuneOverlay from "./DuneOverlay"
import { KONAMI_SEQUENCE } from "./konami"

async function enterKonami() {
  for (const key of KONAMI_SEQUENCE) {
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key }))
    })
  }
}

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
})

test("renders nothing and applies no theme before the sequence is entered", () => {
  render(<DuneOverlay />)
  expect(document.documentElement.dataset.theme).toBeUndefined()
  expect(screen.queryByLabelText(/space guild heighliner/i)).not.toBeInTheDocument()
})

test("the konami sequence activates dune mode, applies the theme attribute, and persists it", async () => {
  render(<DuneOverlay />)
  await enterKonami()
  expect(document.documentElement.dataset.theme).toBe("dune")
  expect(screen.getByLabelText(/space guild heighliner/i)).toBeInTheDocument()
  expect(localStorage.getItem("mcp-explore:dune-mode")).toBe("true")
})

test("entering the sequence again toggles it back off", async () => {
  render(<DuneOverlay />)
  await enterKonami()
  await enterKonami()
  expect(document.documentElement.dataset.theme).toBeUndefined()
  expect(localStorage.getItem("mcp-explore:dune-mode")).toBe("false")
})

test("starts active when localStorage already says so", () => {
  localStorage.setItem("mcp-explore:dune-mode", "true")
  render(<DuneOverlay />)
  expect(document.documentElement.dataset.theme).toBe("dune")
})

test("clicking any button while active starts the transition, which clears itself after the hold", async () => {
  render(<DuneOverlay />)
  await enterKonami()
  const btn = document.createElement("button")
  document.body.appendChild(btn)
  await act(async () => {
    btn.click()
  })
  expect(document.querySelector('[data-departing="true"]')).toBeInTheDocument()
  await act(async () => {
    vi.advanceTimersByTime(4500)
  })
  expect(document.querySelector('[data-departing="true"]')).not.toBeInTheDocument()
  document.body.removeChild(btn)
})

test("the click listener never prevents default — a real button's own handler still fires", async () => {
  render(<DuneOverlay />)
  await enterKonami()
  const onClick = vi.fn()
  const btn = document.createElement("button")
  btn.addEventListener("click", onClick)
  document.body.appendChild(btn)
  await act(async () => {
    btn.click()
  })
  expect(onClick).toHaveBeenCalledTimes(1)
  document.body.removeChild(btn)
})
