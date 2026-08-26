import { generateShip } from "./shipGenerator"
import ShipSvg from "./ShipSvg"
import OrbitTile from "./OrbitTile"
import styles from "./HeighlinerScene.module.css"

export interface HeighlinerSceneProps {
  transitioning: boolean
  shipSeed: string
}

const TILE_COUNT = 10

export default function HeighlinerScene({ transitioning, shipSeed }: HeighlinerSceneProps) {
  const ship = generateShip(shipSeed)

  return (
    <div className={styles.scene} aria-hidden="true">
      <svg
        className={[styles.heighliner, transitioning ? styles.zoomed : ""].join(" ").trim()}
        viewBox="0 0 400 200"
        role="img"
        aria-label="Space Guild heighliner"
      >
        <path
          d="M 20 100 L 90 60 L 300 55 L 360 80 L 360 120 L 300 145 L 90 140 Z"
          fill="var(--dune-hull)"
          stroke="var(--ink-3)"
          strokeWidth={1.5}
        />
        <rect x={110} y={72} width={160} height={10} fill="var(--dune-hull-window)" />
        <rect x={110} y={118} width={160} height={10} fill="var(--dune-hull-window)" />
      </svg>

      <div className={styles.entity} role="img" aria-label="orbited galactic entity" />

      <div className={styles.ring}>
        {Array.from({ length: TILE_COUNT }, (_, i) => (
          <div key={i} className={styles.orbitItem} style={{ "--angle": `${(360 / TILE_COUNT) * i}deg` } as React.CSSProperties}>
            <OrbitTile index={i} />
          </div>
        ))}
      </div>

      <div className={[styles.shipLayer, transitioning ? styles.departing : ""].join(" ").trim()} data-departing={transitioning}>
        <ShipSvg design={ship} />
      </div>
    </div>
  )
}
