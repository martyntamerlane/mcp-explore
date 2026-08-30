/**
 * The landing's hero line. One is chosen at random per page load rather than
 * animating between them: a headline that moves while you are reading it is a
 * distraction, and picking once keeps the line a fixed, screenshot-stable piece
 * of the page for the whole visit.
 */
export const TAGLINES = [
  "See inside any MCP server.",
  "Explore MCP servers before connecting your AI agents with them.",
  "Try a server's tools before you wire them up.",
  "Know what a server offers before you trust it.",
  "Point at an MCP server. See everything it can do.",
]

export function pickTagline(random: () => number = Math.random): string {
  return TAGLINES[Math.floor(random() * TAGLINES.length)]
}
