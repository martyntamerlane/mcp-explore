import { act, render } from "@testing-library/react"
import DuneOverlay from "./DuneOverlay"
import { KONAMI_SEQUENCE } from "./konami"

async function enterKonami() {
  for (const key of KONAMI_SEQUENCE) {
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key }))
    })
  }
}

function sceneIsPresent(): boolean {
  return document.querySelector("[data-dune-scene]") !== null
}

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

test("renders nothing and applies no theme before the sequence is entered", () => {
  render(<DuneOverlay />)
  expect(document.documentElement.dataset.theme).toBeUndefined()
  expect(sceneIsPresent()).toBe(false)
})

test("the konami sequence activates dune mode, applies the theme attribute, and persists it", async () => {
  render(<DuneOverlay />)
  await enterKonami()
  expect(document.documentElement.dataset.theme).toBe("dune")
  expect(sceneIsPresent()).toBe(true)
  expect(localStorage.getItem("mcp-explore:dune-mode")).toBe("true")
})

test("entering the sequence again toggles it back off", async () => {
  render(<DuneOverlay />)
  await enterKonami()
  await enterKonami()
  expect(document.documentElement.dataset.theme).toBeUndefined()
  expect(sceneIsPresent()).toBe(false)
  expect(localStorage.getItem("mcp-explore:dune-mode")).toBe("false")
})

test("starts active when localStorage already says so", () => {
  localStorage.setItem("mcp-explore:dune-mode", "true")
  render(<DuneOverlay />)
  expect(document.documentElement.dataset.theme).toBe("dune")
  expect(sceneIsPresent()).toBe(true)
})

test("does not throw and starts inactive when reading localStorage throws (e.g. private browsing)", () => {
  const original = Storage.prototype.getItem
  Storage.prototype.getItem = () => {
    throw new Error("blocked")
  }
  try {
    expect(() => render(<DuneOverlay />)).not.toThrow()
    expect(document.documentElement.dataset.theme).toBeUndefined()
  } finally {
    Storage.prototype.getItem = original
  }
})

test("does not throw when persisting to localStorage throws — the toggle still applies for the session", async () => {
  const original = Storage.prototype.setItem
  Storage.prototype.setItem = () => {
    throw new Error("blocked")
  }
  try {
    render(<DuneOverlay />)
    await expect(enterKonami()).resolves.toBeUndefined()
    expect(document.documentElement.dataset.theme).toBe("dune")
  } finally {
    Storage.prototype.setItem = original
  }
})

test("clicking a button while active is inert — no listener intercepts it and no transition state appears", async () => {
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
  expect(document.querySelector("[data-departing]")).not.toBeInTheDocument()
  document.body.removeChild(btn)
})
