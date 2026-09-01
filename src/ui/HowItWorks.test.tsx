import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import HowItWorks from "./HowItWorks"

const open = async () => {
  await userEvent.click(screen.getByRole("button", { name: /how this page works/i }))
  return screen.getByRole("dialog")
}

test("the icon is permanent; the panel is not there until it is asked for", () => {
  render(<HowItWorks />)
  expect(screen.getByRole("button", { name: /how this page works/i })).toBeInTheDocument()
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
})

test("it opens on the icon, titled as a description rather than a reassurance", async () => {
  render(<HowItWorks />)
  const dialog = await open()
  expect(dialog).toHaveAttribute("aria-modal", "true")
  expect(screen.getByRole("heading", { name: "How this page works" })).toBeInTheDocument()
})

test("it answers all four questions someone assessing this would ask", async () => {
  render(<HowItWorks />)
  const dialog = await open()
  for (const group of [/where the code runs/i, /what this page connects to/i, /what is stored/i, /what this page does with what a server sends/i]) {
    expect(screen.getByRole("heading", { name: group })).toBeInTheDocument()
  }
  expect(dialog).toBeInTheDocument()
})

/**
 * The load-bearing test. These are the lines a well-meaning future edit tidies
 * away for being off-message, and that edit is exactly what turns a description
 * back into a claim. Anchoring phrases, not whole sentences — pinning prose gets
 * a test deleted the first time someone moves a comma.
 */
test("it states the awkward facts, not only the flattering ones", async () => {
  render(<HowItWorks />)
  const dialog = await open()
  const text = dialog.textContent ?? ""
  expect(text).toMatch(/local storage/i) // and that it is readable by this origin
  expect(text).toMatch(/plain text/i)
  expect(text).toMatch(/GitHub Pages/i) // receives the request for the page itself
  expect(text).toMatch(/IP address/i)
  expect(text).toMatch(/after a connection fails/i) // the extra probe
  expect(text).toMatch(/DeepWiki|Hugging Face/i) // the example servers are third parties
  expect(text).toMatch(/not been independently audited/i)
})

/**
 * The user's instruction, 2026-08-30, made executable: describe what runs, never
 * claim it is safe. A word list is a blunt instrument, but these are the exact
 * words that would signal the stance had drifted back.
 */
test("it makes no safety claims", async () => {
  render(<HowItWorks />)
  const text = (await open()).textContent ?? ""
  for (const banned of ["safe", "secure", "private", "protected", "guarantee", "trust", "we never", "enforce"]) {
    expect(text.toLowerCase()).not.toContain(banned)
  }
})

test("Escape closes the panel and never reaches the app behind it", async () => {
  const behind = vi.fn()
  window.addEventListener("keydown", behind)
  try {
    render(<HowItWorks />)
    await open()
    await userEvent.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    // Escape means "clear the filter, then go home" to the deck (keynav.ts), and
    // home disconnects. One keypress must not close this and drop the server.
    expect(behind).not.toHaveBeenCalled()
  } finally {
    window.removeEventListener("keydown", behind)
  }
})

test("closing returns focus to the icon it came from", async () => {
  render(<HowItWorks />)
  await open()
  await userEvent.click(screen.getByRole("button", { name: /close/i }))
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: /how this page works/i })).toHaveFocus()
})

test("clicking the backdrop closes it; clicking the panel does not", async () => {
  render(<HowItWorks />)
  const dialog = await open()
  await userEvent.click(dialog)
  expect(screen.getByRole("dialog")).toBeInTheDocument()
  await userEvent.click(screen.getByTestId("howitworks-backdrop"))
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
})
