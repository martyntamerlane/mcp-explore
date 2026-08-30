import { useEffect, useState, type RefObject } from "react"

/**
 * Is there enough below the fold to be worth a map of it?
 *
 * The outline used to appear for any result with three headings, which put a
 * navigation column beside output you could already see all of. A list of
 * places to jump to is only an aid when jumping beats scrolling.
 *
 * Two thresholds rather than one. Hiding the outline lets the result's framed
 * panel widen, which makes the content *shorter* — so a single threshold sitting
 * exactly on the boundary would be deciding using a height its own decision
 * changes. Widening never makes content taller, so this cannot actually
 * oscillate, but the gap between the two numbers removes the question rather
 * than leaving it to be reasoned about later.
 */

/** Half a screen of content past the fold before the outline is worth its space. */
export const SHOW_AT_SCREENS = 1.5
/** It stays until clearly not needed, so a small reflow cannot flick it away. */
export const HIDE_BELOW_SCREENS = 1.35

export function screensOf(scrollHeight: number, clientHeight: number): number {
  return clientHeight === 0 ? 0 : scrollHeight / clientHeight
}

/** Pure so the hysteresis is testable without a DOM: previous state in, next out. */
export function nextOverflowing(was: boolean, screens: number): boolean {
  return was ? screens >= HIDE_BELOW_SCREENS : screens >= SHOW_AT_SCREENS
}

/**
 * Watches a scroller and reports whether its content runs far enough past the
 * bottom. `resubscribeKey` re-runs the subscription when the children being
 * observed have been replaced — a new subject, or a new result — since a
 * ResizeObserver holds the elements it was given, not a live selector.
 */
export function useOverflowing(scroller: RefObject<HTMLElement | null>, resubscribeKey: unknown): boolean {
  const [overflowing, setOverflowing] = useState(false)

  useEffect(() => {
    const el = scroller.current
    if (el === null) return

    let frame = 0
    const measure = () => {
      frame = 0
      const screens = screensOf(el.scrollHeight, el.clientHeight)
      setOverflowing((was) => nextOverflowing(was, screens))
    }
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(measure)
    }

    measure()
    window.addEventListener("resize", schedule)
    // The scroller's own box never changes when its content grows, so the
    // children are what has to be watched — the same reason Outline does it.
    // This is what catches a result arriving, "Show more", and "Show raw".
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule)
    observer?.observe(el)
    for (const child of Array.from(el.children)) observer?.observe(child)

    return () => {
      if (frame !== 0) cancelAnimationFrame(frame)
      window.removeEventListener("resize", schedule)
      observer?.disconnect()
    }
  }, [scroller, resubscribeKey])

  return overflowing
}
