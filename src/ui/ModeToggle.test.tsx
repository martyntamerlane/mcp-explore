import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import ModeToggle from "./ModeToggle"

afterEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.mode
  vi.unstubAllGlobals()
})

const stubMatchMedia = (dark: boolean) =>
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("dark") && dark,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))

test("initialises from the system preference and stamps the root", () => {
  stubMatchMedia(true)
  render(<ModeToggle />)
  expect(document.documentElement.dataset.mode).toBe("dark")
  expect(screen.getByRole("button", { name: /switch to light mode/i })).toBeInTheDocument()
})

test("clicking toggles the mode and persists the explicit choice", async () => {
  stubMatchMedia(false)
  render(<ModeToggle />)
  expect(document.documentElement.dataset.mode).toBe("light")
  await userEvent.click(screen.getByRole("button", { name: /switch to dark mode/i }))
  expect(document.documentElement.dataset.mode).toBe("dark")
  expect(localStorage.getItem("mcp-explore:mode")).toBe("dark")
  await userEvent.click(screen.getByRole("button", { name: /switch to light mode/i }))
  expect(document.documentElement.dataset.mode).toBe("light")
  expect(localStorage.getItem("mcp-explore:mode")).toBe("light")
})

test("a stored choice beats the system preference on mount", () => {
  stubMatchMedia(true)
  localStorage.setItem("mcp-explore:mode", "light")
  render(<ModeToggle />)
  expect(document.documentElement.dataset.mode).toBe("light")
})
