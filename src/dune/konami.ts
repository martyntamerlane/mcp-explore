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
  let progress = 0
  return function handleKey(key: string) {
    const expected = KONAMI_SEQUENCE[progress]
    if (key.toLowerCase() === expected.toLowerCase()) {
      progress++
      if (progress === KONAMI_SEQUENCE.length) {
        progress = 0
        onMatch()
      }
    } else if (key.toLowerCase() === KONAMI_SEQUENCE[0].toLowerCase()) {
      // Wrong key but matches position 0
      // Set progress to 1, then check if the key also matches position 1
      progress = 1
      if (KONAMI_SEQUENCE[1] && key.toLowerCase() === KONAMI_SEQUENCE[1].toLowerCase()) {
        progress = 2
      }
    } else {
      progress = 0
    }
  }
}
