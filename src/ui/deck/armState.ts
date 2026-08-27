import type { RunClass } from "./deckModel"

/** Disarm delay for an armed-but-unfired button (redesign spec §4). */
export const ARM_TIMEOUT_MS = 4000

export interface ArmResult {
  armedId: string | null
  fire: string | null
}

/**
 * Pure arm-then-fire transition (spec §4). Exactly one tool may be armed at a
 * time; timers and disarm listeners live in the DeckView hook, not here.
 */
export function pressTool(armedId: string | null, id: string, runClass: RunClass): ArmResult {
  switch (runClass) {
    case "instant":
      return { armedId: null, fire: id }
    case "arm":
      if (armedId === id) return { armedId: null, fire: id }
      return { armedId: id, fire: null }
    case "input-required":
      return { armedId: null, fire: null }
  }
}
