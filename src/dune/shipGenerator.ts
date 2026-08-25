export interface ShipDesign {
  hullArchetype: "sleek" | "blocky" | "finned" | "saucer" | "spike"
  accentColors: [string, string, string]
  engineGlow: string
  greebles: { x: number; y: number }[]
  finCount: number
}

const HULL_ARCHETYPES: ShipDesign["hullArchetype"][] = ["sleek", "blocky", "finned", "saucer", "spike"]

// Dune-direction hues: spice-amber, sand, deep Fremen-blue, bone, rust
const HUE_POOL = [32, 38, 210, 45, 14]

// FNV-1a: small, fast, deterministic string -> 32-bit hash. No dependency.
function fnv1a(str: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

// mulberry32: small, fast, deterministic PRNG. No dependency.
function mulberry32(seed: number): () => number {
  let a = seed
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hsl(h: number, s: number, l: number): string {
  return `hsl(${((h % 360) + 360) % 360} ${s}% ${l}%)`
}

export function generateShip(seed: string): ShipDesign {
  const rand = mulberry32(fnv1a(seed))
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]

  const hullArchetype = pick(HULL_ARCHETYPES)
  const baseHue = pick(HUE_POOL)
  const accentColors: [string, string, string] = [
    hsl(baseHue, 55, 45),
    hsl(baseHue + 20, 50, 60),
    hsl(baseHue + 340, 40, 30),
  ]
  const engineGlow = hsl(baseHue + 180, 80, 65)
  const finCount = 2 + Math.floor(rand() * 3)
  const greebleCount = 6 + Math.floor(rand() * 10)
  const greebles = Array.from({ length: greebleCount }, () => ({
    x: -40 + rand() * 80,
    y: -12 + rand() * 24,
  }))

  return { hullArchetype, accentColors, engineGlow, greebles, finCount }
}
