import {
  HIDE_BELOW_SCREENS,
  SHOW_AT_SCREENS,
  nextOverflowing,
  screensOf,
} from "./useOverflowing"

/**
 * The measuring and the hysteresis are pure so they can be tested without a
 * layout engine — jsdom reports every scrollHeight as 0, so the hook itself is
 * verified in a real browser instead (see the 2026-08-30 wide-block spec).
 */

test("screens is the scroller's content over what fits", () => {
  expect(screensOf(2000, 1000)).toBe(2)
  expect(screensOf(1000, 1000)).toBe(1)
})

test("a zero-height scroller is not overflowing, and never divides by zero", () => {
  // Before layout, and in jsdom, both heights are 0.
  expect(screensOf(0, 0)).toBe(0)
  expect(nextOverflowing(false, screensOf(0, 0))).toBe(false)
})

test("a result that fits gets no outline", () => {
  expect(nextOverflowing(false, 1)).toBe(false)
  expect(nextOverflowing(false, 1.4)).toBe(false)
})

test("half a screen past the fold is where it earns its space", () => {
  expect(nextOverflowing(false, SHOW_AT_SCREENS)).toBe(true)
  expect(nextOverflowing(false, 25)).toBe(true)
})

test("once shown it stays until clearly unneeded, so a reflow cannot flick it away", () => {
  // The gap between the two thresholds is the whole point: hiding the outline
  // widens the blocks below it, which shortens the content that decided it.
  expect(nextOverflowing(true, 1.4)).toBe(true)
  expect(nextOverflowing(true, HIDE_BELOW_SCREENS)).toBe(true)
  expect(nextOverflowing(true, 1.2)).toBe(false)
})

test("the thresholds leave a real gap rather than touching", () => {
  expect(HIDE_BELOW_SCREENS).toBeLessThan(SHOW_AT_SCREENS)
})

test("a value between the thresholds keeps whatever is already on screen", () => {
  const between = (SHOW_AT_SCREENS + HIDE_BELOW_SCREENS) / 2
  expect(nextOverflowing(true, between)).toBe(true)
  expect(nextOverflowing(false, between)).toBe(false)
})
