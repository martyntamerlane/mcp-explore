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

export function createKonamiDetector(onMatch: () => void): (key: string) => void {
  const buffer: string[] = []
  return function handleKey(key: string) {
    buffer.push(key.toLowerCase())
    if (buffer.length > KONAMI_SEQUENCE.length) buffer.shift()
    if (buffer.length === KONAMI_SEQUENCE.length && buffer.every((k, i) => k === KONAMI_SEQUENCE[i].toLowerCase())) {
      buffer.length = 0
      onMatch()
    }
  }
}
