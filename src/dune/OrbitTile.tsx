import styles from "./OrbitTile.module.css"

const MOTIFS = ["storm", "dunes", "moons", "starfield", "wormsign"] as const
type Motif = (typeof MOTIFS)[number]

export interface OrbitTileProps {
  index: number
  size?: number
}

export default function OrbitTile({ index, size = 64 }: OrbitTileProps) {
  const motif: Motif = MOTIFS[index % MOTIFS.length]
  const hue = (index * 36) % 360
  const id = `orbit-tile-${index}`

  return (
    <svg
      className={styles.tile}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={`${motif} generative art`}
      data-motif={motif}
    >
      <defs>
        <clipPath id={`${id}-clip`}>
          <circle cx={32} cy={32} r={30} />
        </clipPath>
        {(motif === "storm" || motif === "dunes") && (
          <filter id={`${id}-turb`}>
            <feTurbulence
              type="fractalNoise"
              baseFrequency={motif === "storm" ? 0.09 : 0.02}
              numOctaves={2}
              seed={index}
              result="noise"
            />
            <feColorMatrix
              in="noise"
              type="matrix"
              values={`0 0 0 0 ${0.5 + (hue % 60) / 200}  0 0 0 0 0.3  0 0 0 0 0.1  0 0 0 0.6 0`}
            />
          </filter>
        )}
        <radialGradient id={`${id}-glow`}>
          <stop offset="0%" stopColor={`hsl(${hue} 70% 60%)`} />
          <stop offset="100%" stopColor={`hsl(${hue} 70% 15%)`} />
        </radialGradient>
      </defs>
      <g clipPath={`url(#${id}-clip)`} className={styles.drift}>
        <rect width={64} height={64} fill={`hsl(${hue} 40% 10%)`} />
        {(motif === "storm" || motif === "dunes") && <rect width={64} height={64} filter={`url(#${id}-turb)`} />}
        {motif === "moons" && (
          <>
            <circle cx={24} cy={30} r={14} fill={`url(#${id}-glow)`} />
            <circle cx={44} cy={40} r={8} fill={`hsl(${hue} 50% 70%)`} opacity={0.8} />
          </>
        )}
        {motif === "starfield" &&
          Array.from({ length: 12 }, (_, i) => (
            <circle
              key={i}
              cx={(i * 17 + index * 5) % 64}
              cy={(i * 29 + index * 11) % 64}
              r={i % 5 === 0 ? 1.6 : 0.8}
              fill="var(--dune-star)"
              opacity={0.8}
            />
          ))}
        {motif === "wormsign" && (
          <path
            d={`M 4 ${32 + (index % 3) * 4} Q 20 ${16 + (index % 5) * 3}, 32 32 T 60 ${32 - (index % 4) * 3}`}
            stroke={`hsl(${hue} 60% 55%)`}
            strokeWidth={3}
            fill="none"
            opacity={0.7}
          />
        )}
      </g>
      <circle cx={32} cy={32} r={30} fill="none" stroke="var(--dune-tile-rim)" strokeWidth={1} />
    </svg>
  )
}
