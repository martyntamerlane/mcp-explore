import styles from "./Prism.module.css"

export type PrismVariant = "a" | "b" | "c"

/**
 * The brand mark: one white-ink line in, three tinted threads out — the data
 * model as geometry (one server, three capability kinds). Abstract hairlines
 * only; no literal glass-triangle kitsch (redesign spec §2).
 * Variant "b" was picked 2026-08-29 (TODO-20.2) and is also the favicon in
 * index.html: at 16px the open triangle of "a" and the bare hairline of "c" both
 * collapse into indistinct scratches, and a closed outline is the only one of
 * the three that survives. Keep the two in step — the mark and the favicon are
 * the same shape or the tab stops being recognisable.
 */
export default function Prism({ variant = "b", className }: { variant?: PrismVariant; className?: string }) {
  const cls = className ? `${styles.prism} ${className}` : styles.prism
  if (variant === "b") {
    // b: closed triangle, threads refract from its right face
    return (
      <svg className={cls} viewBox="0 0 48 32" aria-hidden="true" fill="none" strokeWidth="1.5">
        <path d="M2 16 H18" stroke="var(--ink)" />
        <path d="M18 7 L34 16 L18 25 Z" stroke="var(--ink)" strokeLinejoin="round" />
        <path d="M34 16 L46 8" stroke="var(--tool)" />
        <path d="M34 16 H46" stroke="var(--resource)" />
        <path d="M34 16 L46 24" stroke="var(--prompt)" />
      </svg>
    )
  }
  if (variant === "c") {
    // c: no solid body — the split point is implied by a single vertical hairline
    return (
      <svg className={cls} viewBox="0 0 48 32" aria-hidden="true" fill="none" strokeWidth="1.5">
        <path d="M2 16 H22" stroke="var(--ink)" />
        <path d="M22 9 V23" stroke="var(--ink)" />
        <path d="M22 12 C32 12 36 6 46 6" stroke="var(--tool)" />
        <path d="M22 16 H46" stroke="var(--resource)" />
        <path d="M22 20 C32 20 36 26 46 26" stroke="var(--prompt)" />
      </svg>
    )
  }
  // a: open triangular prism, threads diverge through it
  return (
    <svg className={cls} viewBox="0 0 48 32" aria-hidden="true" fill="none" strokeWidth="1.5">
      <path d="M2 16 H20" stroke="var(--ink)" />
      <path d="M20 8 L28 16 L20 24 Z" stroke="var(--ink)" strokeLinejoin="round" />
      <path d="M28 16 L46 6" stroke="var(--tool)" />
      <path d="M28 16 H46" stroke="var(--resource)" />
      <path d="M28 16 L46 26" stroke="var(--prompt)" />
    </svg>
  )
}
