import { createKonamiDetector, KONAMI_SEQUENCE } from "./konami"

function press(handler: (key: string) => void, keys: string[]) {
  keys.forEach((k) => handler(k))
}

test("the exact sequence triggers onMatch once", () => {
  const onMatch = vi.fn()
  const handler = createKonamiDetector(onMatch)
  press(handler, [...KONAMI_SEQUENCE])
  expect(onMatch).toHaveBeenCalledTimes(1)
})

test("the user-visible sequence is exactly ↑ ↑ ↓ ↓ ← →", () => {
  const onMatch = vi.fn()
  const handler = createKonamiDetector(onMatch)
  press(handler, ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight"])
  expect(onMatch).toHaveBeenCalledTimes(1)
})

test("a wrong key mid-sequence prevents a match", () => {
  const onMatch = vi.fn()
  const handler = createKonamiDetector(onMatch)
  press(handler, ["ArrowUp", "ArrowUp", "x"])
  press(handler, ["ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight"])
  expect(onMatch).not.toHaveBeenCalled()
})

test("an extra leading first-key press still matches — the window slides", () => {
  const onMatch = vi.fn()
  const handler = createKonamiDetector(onMatch)
  // ArrowUp, ArrowUp, ArrowUp(extra) then the rest — the trailing window is valid
  press(handler, ["ArrowUp", "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight"])
  expect(onMatch).toHaveBeenCalledTimes(1)
})

test("typing the sequence twice in a row triggers onMatch twice", () => {
  const onMatch = vi.fn()
  const handler = createKonamiDetector(onMatch)
  press(handler, [...KONAMI_SEQUENCE])
  press(handler, [...KONAMI_SEQUENCE])
  expect(onMatch).toHaveBeenCalledTimes(2)
})

test("no false positives when the sequence is not a contiguous window", () => {
  const onMatch = vi.fn()
  const handler = createKonamiDetector(onMatch)
  // Partial matches throughout, but no valid contiguous six-key window
  press(handler, ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"])
  expect(onMatch).not.toHaveBeenCalled()
})

test("modifier keydowns (Shift, Control, Alt, Meta, CapsLock) between real keys are ignored, not treated as wrong keys", () => {
  const onMatch = vi.fn()
  const handler = createKonamiDetector(onMatch)
  press(handler, ["ArrowUp", "ArrowUp"])
  handler("Shift")
  handler("Control")
  handler("Alt")
  handler("Meta")
  handler("CapsLock")
  press(handler, ["ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight"])
  expect(onMatch).toHaveBeenCalledTimes(1)
})
