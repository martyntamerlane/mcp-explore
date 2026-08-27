// Shortened from the full 10-key Konami code (user call, 2026-08-26): the
// arrows-only prefix is easier to remember and type, and no letter keys means
// no collision risk with typing in the connect-URL input beyond the arrows.
export const KONAMI_SEQUENCE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
] as const

// Modifier keydowns a real keyboard can fire mid-sequence (e.g. a held Shift)
// must never enter the buffer, or they would read as wrong keys and break an
// otherwise-valid sequence. Matched case-sensitively against the literal
// KeyboardEvent.key values browsers send for these keys.
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
