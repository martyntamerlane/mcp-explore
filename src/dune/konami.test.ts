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

test("case-insensitive on the letter keys", () => {
  const onMatch = vi.fn()
  const handler = createKonamiDetector(onMatch)
  press(handler, ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "B", "A"])
  expect(onMatch).toHaveBeenCalledTimes(1)
})

test("a wrong key resets progress to zero", () => {
  const onMatch = vi.fn()
  const handler = createKonamiDetector(onMatch)
  press(handler, ["ArrowUp", "ArrowUp", "x"])
  press(handler, ["ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"])
  expect(onMatch).not.toHaveBeenCalled()
})

test("a wrong key that equals the first key restarts progress at one, not zero", () => {
  const onMatch = vi.fn()
  const handler = createKonamiDetector(onMatch)
  // ArrowUp, ArrowUp, ArrowUp(wrong-but-equals-first) then the rest of a valid sequence
  press(handler, ["ArrowUp", "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"])
  expect(onMatch).toHaveBeenCalledTimes(1)
})

test("typing the sequence twice in a row triggers onMatch twice", () => {
  const onMatch = vi.fn()
  const handler = createKonamiDetector(onMatch)
  press(handler, [...KONAMI_SEQUENCE])
  press(handler, [...KONAMI_SEQUENCE])
  expect(onMatch).toHaveBeenCalledTimes(2)
})

test("no false positives when sequence is not a contiguous window", () => {
  const onMatch = vi.fn()
  const handler = createKonamiDetector(onMatch)
  // This input has partial matches but no valid 10-key contiguous sequence
  press(handler, ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"])
  expect(onMatch).not.toHaveBeenCalled()
})

test("a Shift keydown between real sequence keys — as a real keyboard sends before an uppercase letter — does not break the match", () => {
  const onMatch = vi.fn()
  const handler = createKonamiDetector(onMatch)
  press(handler, ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight"])
  // A real keyboard fires a Shift keydown before the browser reports an uppercase "B".
  handler("Shift")
  press(handler, ["B", "A"])
  expect(onMatch).toHaveBeenCalledTimes(1)
})

test("Control, Alt, Meta, and CapsLock keydowns are likewise ignored, not treated as wrong keys", () => {
  const onMatch = vi.fn()
  const handler = createKonamiDetector(onMatch)
  press(handler, ["ArrowUp", "ArrowUp"])
  handler("Control")
  handler("Alt")
  handler("Meta")
  handler("CapsLock")
  press(handler, ["ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"])
  expect(onMatch).toHaveBeenCalledTimes(1)
})
