import { act, render, screen } from "@testing-library/react"
import DuneOverlay from "./DuneOverlay"
import { KONAMI_SEQUENCE } from "./konami"
import { generateShip } from "./shipGenerator"

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

test("the departure transition fires at most once per activation, and again after toggling off and back on", async () => {
  render(<DuneOverlay />)
  await enterKonami()

  const btn1 = document.createElement("button")
  document.body.appendChild(btn1)
  await act(async () => {
    btn1.click()
  })
  expect(document.querySelector('[data-departing="true"]')).toBeInTheDocument()

  // Let the hold complete so transitioning resets to false — hasDeparted should
  // still block a re-trigger even though transitioning is no longer true.
  await act(async () => {
    vi.advanceTimersByTime(4500)
  })
  expect(document.querySelector('[data-departing="true"]')).not.toBeInTheDocument()

  const btn2 = document.createElement("button")
  document.body.appendChild(btn2)
  await act(async () => {
    btn2.click()
  })
  expect(document.querySelector('[data-departing="true"]')).not.toBeInTheDocument()

  // Toggle dune mode off, then back on — a fresh activation gets its own one-shot.
  await enterKonami()
  await enterKonami()

  const btn3 = document.createElement("button")
  document.body.appendChild(btn3)
  await act(async () => {
    btn3.click()
  })
  expect(document.querySelector('[data-departing="true"]')).toBeInTheDocument()

  document.body.removeChild(btn1)
  document.body.removeChild(btn2)
  document.body.removeChild(btn3)
})

test("clicking a button inside a <form> seeds the ship from that form's input value, not the page URL", async () => {
  render(<DuneOverlay />)
  await enterKonami()

  const form = document.createElement("form")
  const input = document.createElement("input")
  input.value = "https://custom-seed.example/mcp"
  const btn = document.createElement("button")
  form.append(input, btn)
  document.body.appendChild(form)

  await act(async () => {
    btn.click()
  })

  const expected = generateShip("https://custom-seed.example/mcp")
  expect(screen.getByRole("img", { name: new RegExp(`${expected.hullArchetype} ship$`), hidden: true })).toBeInTheDocument()

  document.body.removeChild(form)
})

test("clicking a button whose own text content is a URL (a recent-server-style button) seeds the ship from that text", async () => {
  render(<DuneOverlay />)
  await enterKonami()

  const btn = document.createElement("button")
  btn.textContent = "https://recent-seed.example/mcp"
  document.body.appendChild(btn)

  await act(async () => {
    btn.click()
  })

  const expected = generateShip("https://recent-seed.example/mcp")
  expect(screen.getByRole("img", { name: new RegExp(`${expected.hullArchetype} ship$`), hidden: true })).toBeInTheDocument()

  document.body.removeChild(btn)
})

test("clicking a button with no form and no URL-like text falls back to the page URL as the seed", async () => {
  render(<DuneOverlay />)
  await enterKonami()

  const btn = document.createElement("button")
  btn.textContent = "Try the demo"
  document.body.appendChild(btn)

  await act(async () => {
    btn.click()
  })

  const expected = generateShip(window.location.href)
  expect(screen.getByRole("img", { name: new RegExp(`${expected.hullArchetype} ship$`), hidden: true })).toBeInTheDocument()

  document.body.removeChild(btn)
})
