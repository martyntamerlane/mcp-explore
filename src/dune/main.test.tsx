import { STORAGE_KEY } from "./DuneOverlay"

// Regression coverage for the "theme flash" fix: main.tsx must apply the dune theme
// attribute synchronously, at import time — before DuneOverlay's own useEffect would
// get a chance to run — so a returning dune-mode visitor's first paint is never in the
// default palette. Using dynamic import + vi.resetModules() so main.tsx's top-level
// side effects (which run once per module instance) re-run for each test.

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
  vi.resetModules()
})

afterEach(() => {
  document.querySelectorAll("#dune-root").forEach((el) => el.remove())
})

test("applies the dune theme attribute synchronously on import when localStorage says active", async () => {
  localStorage.setItem(STORAGE_KEY, "true")
  await import("./main")
  // No microtask/effect flush happened yet — if this were still set only in
  // DuneOverlay's useEffect, it would not be present here.
  expect(document.documentElement.dataset.theme).toBe("dune")
})

test("does not apply the theme attribute on import when localStorage says inactive", async () => {
  localStorage.setItem(STORAGE_KEY, "false")
  await import("./main")
  expect(document.documentElement.dataset.theme).toBeUndefined()
})

test("does not throw when localStorage access fails", async () => {
  const original = Storage.prototype.getItem
  Storage.prototype.getItem = () => {
    throw new Error("blocked")
  }
  try {
    await expect(import("./main")).resolves.toBeDefined()
    expect(document.documentElement.dataset.theme).toBeUndefined()
  } finally {
    Storage.prototype.getItem = original
  }
})
