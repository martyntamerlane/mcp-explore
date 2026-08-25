import type { ShipDesign } from "./shipGenerator"

const HULL_PATH: Record<ShipDesign["hullArchetype"], string> = {
  sleek: "M -60 0 L -20 -10 L 50 -4 L 60 0 L 50 4 L -20 10 Z",
  blocky: "M -55 -10 L 40 -10 L 55 -4 L 55 4 L 40 10 L -55 10 Z",
  finned: "M -50 0 L -10 -14 L 45 -6 L 55 0 L 45 6 L -10 14 Z",
  saucer: "M -55 0 C -55 -14 55 -14 55 0 C 55 14 -55 14 -55 0 Z",
  spike: "M -60 0 L 10 -8 L 60 0 L 10 8 Z",
}

export interface ShipSvgProps {
  design: ShipDesign
  size?: number
  className?: string
}

export default function ShipSvg({ design, size = 140, className }: ShipSvgProps) {
  const { hullArchetype, accentColors, engineGlow, greebles, finCount } = design
  return (
    <svg
      className={className}
      viewBox="-70 -30 140 60"
      width={size}
      height={(size * 60) / 140}
      role="img"
      aria-label={`${hullArchetype} ship`}
    >
      <path d={HULL_PATH[hullArchetype]} fill={accentColors[0]} stroke={accentColors[2]} strokeWidth={1.5} />
      {greebles.map((g, i) => (
        <rect key={i} x={g.x - 1.5} y={g.y - 1.5} width={3} height={3} fill={accentColors[1]} />
      ))}
      {Array.from({ length: finCount }, (_, i) => {
        const angle = (i / Math.max(finCount - 1, 1)) * 40 - 20
        return (
          <line
            key={i}
            x1={-45}
            y1={0}
            x2={-60}
            y2={0}
            stroke={accentColors[2]}
            strokeWidth={2}
            transform={`rotate(${angle} -45 0)`}
          />
        )
      })}
      <circle cx={58} cy={0} r={5} fill={engineGlow} opacity={0.9} />
    </svg>
  )
}
