import { applyMode, followSystem, initialMode, saveMode, storedMode, systemMode } from "./mode"

afterEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.mode
  vi.unstubAllGlobals()
})

const stubMatchMedia = (dark: boolean, listeners: ((e: { matches: boolean }) => void)[] = []) =>
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("dark") && dark,
    media: query,
    addEventListener: (_: string, cb: (e: { matches: boolean }) => void) => listeners.push(cb),
    removeEventListener: (_: string, cb: (e: { matches: boolean }) => void) => {
      const i = listeners.indexOf(cb)
      if (i >= 0) listeners.splice(i, 1)
    },
  }))

test("systemMode reads prefers-color-scheme and defaults to light without matchMedia", () => {
  stubMatchMedia(true)
  expect(systemMode()).toBe("dark")
  stubMatchMedia(false)
  expect(systemMode()).toBe("light")
  vi.stubGlobal("matchMedia", undefined)
  expect(systemMode()).toBe("light")
})

test("initialMode: a stored choice beats the system preference", () => {
  stubMatchMedia(true)
  expect(initialMode()).toBe("dark")
  saveMode("light")
  expect(storedMode()).toBe("light")
  expect(initialMode()).toBe("light")
})

test("garbage in storage is ignored", () => {
  localStorage.setItem("mcp-explore:mode", "purple")
  expect(storedMode()).toBeNull()
})

test("applyMode stamps data-mode on the root element", () => {
  applyMode("dark")
  expect(document.documentElement.dataset.mode).toBe("dark")
  applyMode("light")
  expect(document.documentElement.dataset.mode).toBe("light")
})

test("followSystem notifies on change and unsubscribes cleanly", () => {
  const listeners: ((e: { matches: boolean }) => void)[] = []
  stubMatchMedia(false, listeners)
  const seen: string[] = []
  const stop = followSystem((m) => seen.push(m))
  expect(listeners).toHaveLength(1)
  listeners[0]({ matches: true })
  expect(seen).toEqual(["dark"])
  stop()
  expect(listeners).toHaveLength(0)
})

test("followSystem is a no-op without matchMedia", () => {
  vi.stubGlobal("matchMedia", undefined)
  expect(() => followSystem(() => {})()).not.toThrow()
})
