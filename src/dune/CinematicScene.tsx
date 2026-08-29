import { useEffect, useRef } from "react"
import heroUrl from "./assets/hero.webp"
import styles from "./CinematicScene.module.css"

// mulberry32 — tiny deterministic PRNG. Dune-mode constraint: no Math.random
// anywhere in src/dune/, so the star field is seeded and identical every render.
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

const FIELD_STAR_COUNT = 200
const BRIGHT_STAR_COUNT = 12

interface Star {
  left: number
  top: number
  size: number
  opacity: number
  twinkles: boolean
  duration: number
  delay: number
  peak: number
}

function generateStars(): { field: Star[]; bright: Star[] } {
  const rand = mulberry32(0x5eed)
  const field = Array.from({ length: FIELD_STAR_COUNT }, () => ({
    left: rand() * 100,
    top: rand() * 100,
    size: rand() < 0.1 ? 2 : 1,
    opacity: 0.1 + rand() * 0.4,
    twinkles: rand() < 0.45,
    duration: 2.5 + rand() * 4,
    delay: rand() * 6,
    peak: 0.3 + rand() * 0.5,
  }))
  const bright = Array.from({ length: BRIGHT_STAR_COUNT }, () => ({
    left: rand() * 100,
    top: rand() * 60,
    size: 2,
    opacity: 0.9,
    twinkles: true,
    duration: 3 + rand() * 4,
    delay: rand() * 5,
    peak: 0.9,
  }))
  return { field, bright }
}

const STARS = generateStars()

// The hero image's limb is an arc — quadratic fitted through three limb points
// read off a 16:9 render: (6vw, 94vh), (31vw, 76.7vh), (50vw, 37.5vh — the
// sun's crest). The planet surface is below it; city lights live only there.
function limbY(x: number): number {
  return -0.0312 * x * x + 0.461 * x + 92.4
}

interface CityLight {
  left: number
  top: number
  size: number
  kind: "warm" | "cool" | "halo" | "shade"
  duration: number
  delay: number
  peak: number
}

// City lights only read against dark ground, and this hero image's surface is
// almost entirely sunlit cloud — the one truly dark region is the shadowed
// swirl band along the bottom-center. All clusters live there, each over its
// own multiply-blended "night patch" that deepens the local dusk.
const CITY_CLUSTERS = 11

function generateCities(): CityLight[] {
  const rand = mulberry32(0xc171)
  const lights: CityLight[] = []
  const centers: Array<[number, number]> = []
  for (let c = 0; c < CITY_CLUSTERS; c++) {
    centers.push([24 + rand() * 32, 89 + rand() * 8.5])
  }
  for (const [cx, cy] of centers) {
    const haloSize = 50 + rand() * 50
    lights.push({
      left: cx,
      top: cy,
      size: haloSize * 2.2,
      kind: "shade",
      duration: 8 + rand() * 8,
      delay: rand() * 8,
      peak: 1,
    })
    lights.push({
      left: cx,
      top: cy,
      size: haloSize,
      kind: "halo",
      duration: 8 + rand() * 8,
      delay: rand() * 8,
      peak: 1,
    })
    const dotCount = 4 + Math.floor(rand() * 5)
    for (let d = 0; d < dotCount; d++) {
      const dx = cx + (rand() * 5 - 2.5)
      const dy = cy + (rand() * 3.6 - 1.8)
      lights.push({
        left: dx,
        top: Math.min(98.5, Math.max(dy, limbY(dx) + 2)),
        size: 2.5 + rand() * 4,
        kind: rand() < 0.75 ? "warm" : "cool",
        duration: 6 + rand() * 8,
        delay: rand() * 8,
        peak: 0.35 + rand() * 0.45,
      })
    }
  }
  return lights
}

const CITIES = generateCities()

function starStyle(s: Star): React.CSSProperties {
  return {
    left: `${s.left}vw`,
    top: `${s.top}vh`,
    width: s.size,
    height: s.size,
    opacity: s.opacity,
    "--d": `${s.duration}s`,
    "--dl": `${s.delay}s`,
    "--o": s.peak,
  } as React.CSSProperties
}

export default function CinematicScene() {
  const rootRef = useRef<HTMLDivElement>(null)

  // Pointer parallax: each [data-px] layer shifts by its own depth factor,
  // eased toward the cursor. Passive observation only — never intercepts input.
  useEffect(() => {
    if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const layers = Array.from(rootRef.current?.querySelectorAll<HTMLElement>("[data-px]") ?? [])
    let tx = 0
    let ty = 0
    let cx = 0
    let cy = 0
    let raf = 0
    const onMove = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth) * 2 - 1
      ty = (e.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener("pointermove", onMove)
    const tick = () => {
      cx += (tx - cx) * 0.04
      cy += (ty - cy) * 0.04
      for (const layer of layers) {
        const px = Number(layer.dataset.px)
        layer.style.transform = `translate3d(${-cx * px}px, ${-cy * px}px, 0)`
      }
      raf = requestAnimationFrame(tick)
    }
    if (typeof requestAnimationFrame === "function") raf = requestAnimationFrame(tick)
    return () => {
      window.removeEventListener("pointermove", onMove)
      if (typeof cancelAnimationFrame === "function" && raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div ref={rootRef} className={styles.scene} aria-hidden="true" data-dune-scene>
      <div className={styles.zoom}>
        <div className={styles.lyr} data-px="4">
          <img className={styles.base} src={heroUrl} alt="" />
          <img className={styles.baseGlow} src={heroUrl} alt="" />
          <div className={styles.cities} data-cities>
            {CITIES.map((c, i) => (
              <i
                key={i}
                className={
                  c.kind === "shade"
                    ? styles.cityShade
                    : c.kind === "halo"
                      ? styles.cityHalo
                      : c.kind === "warm"
                        ? styles.cityWarm
                        : styles.cityCool
                }
                style={
                  {
                    left: `${c.left}vw`,
                    top: `${c.top}vh`,
                    width: c.size,
                    height: c.size,
                    "--d": `${c.duration}s`,
                    "--dl": `${c.delay}s`,
                    "--o": c.peak,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
        </div>
        <div className={styles.lyr} data-px="10">
          <div className={styles.nebula} />
        </div>
        <div className={styles.lyr} data-px="14">
          <div className={styles.stars} data-stars>
            {STARS.field.map((s, i) => (
              <i key={i} className={s.twinkles ? styles.tw : undefined} style={starStyle(s)} />
            ))}
            {STARS.bright.map((s, i) => (
              <i key={`b${i}`} className={[styles.big, styles.tw].join(" ")} style={starStyle(s)} />
            ))}
            <div className={styles.shooter} />
          </div>
        </div>
        <div className={styles.lyr} data-px="8">
          <div className={styles.sun}>
            <div className={styles.bloom} />
            <div className={styles.streak} />
            <div className={styles.core} />
          </div>
        </div>
        <div className={styles.lyr} data-px="20">
          <div className={styles.haze1} />
          <div className={styles.haze2} />
        </div>
      </div>

      <div className={styles.grade} />
      <svg className={styles.grain} width="100%" height="100%">
        <filter id="dune-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" />
        </filter>
        <rect width="100%" height="100%" filter="url(#dune-grain)" />
      </svg>
    </div>
  )
}
