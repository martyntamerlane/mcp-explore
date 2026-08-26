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
        </div>
        <div className={styles.lyr} data-px="10">
          <div className={styles.nebula} />
        </div>
        <div className={styles.lyr} data-px="14">
          <div className={styles.stars}>
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
