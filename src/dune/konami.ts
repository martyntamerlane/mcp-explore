export const KONAMI_SEQUENCE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
] as const

// Modifier keydowns a real keyboard fires en route to a letter — e.g. Shift
// before an uppercase "B" — must never enter the buffer, or the sequence's
// case-insensitive letter matching becomes unreachable outside synthetic tests.
// Matched case-sensitively against the literal KeyboardEvent.key values browsers
// send for these keys.
const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta", "CapsLock"])

export function createKonamiDetector(onMatch: () => void): (key: string) => void {
  const buffer: string[] = []
  return function handleKey(key: string) {
    if (MODIFIER_KEYS.has(key)) return
    buffer.push(key.toLowerCase())
    if (buffer.length > KONAMI_SEQUENCE.length) buffer.shift()
    if (buffer.length === KONAMI_SEQUENCE.length && buffer.every((k, i) => k === KONAMI_SEQUENCE[i].toLowerCase())) {
      buffer.length = 0
      onMatch()
    }
  }
}
