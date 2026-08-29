import { looksLikeMarkdown } from "../markdown/detect"
import { documentHeadings, parseDocument, type HeadingRef } from "../markdown/parse"

/**
 * The outline of a rendered result (interaction roadmap S4 / TODO-29).
 *
 * Derived from exactly what `TextBlock` renders — same markdown test, same
 * parse, same `b<i>` id prefix — so an outline entry and the heading it points
 * at can never disagree. Parsing twice is the price of not threading state up
 * through the render tree; both calls are memoised by their callers and the text
 * is capped at 50,000 characters before it ever gets here.
 */

/**
 * Three: below that the headings are already all on screen and a list of them is
 * furniture with nothing to do. Checked against a short deepwiki `ask_question`
 * answer (0–2 headings, no outline) and `read_wiki_contents` (dozens).
 */
export const MIN_HEADINGS = 3

/** The shape both `RunDisplay` and `ReadDisplay` blocks satisfy. */
export interface OutlineSource {
  text?: string
  mime?: string
}

export function outlineOf(blocks: readonly OutlineSource[]): HeadingRef[] {
  const entries: HeadingRef[] = []
  blocks.forEach((block, i) => {
    if (block.text === undefined || !looksLikeMarkdown(block.text, block.mime)) return
    entries.push(...documentHeadings(parseDocument(block.text, `b${i}`)))
  })
  return entries
}

/** An outline is worth showing only when it has somewhere to take you. */
export const worthShowing = (entries: readonly HeadingRef[]) => entries.length >= MIN_HEADINGS
