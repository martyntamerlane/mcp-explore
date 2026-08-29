/**
 * Is this untrusted string markdown?
 *
 * Deliberately conservative. A false negative costs nothing — the text renders
 * as it always has, in a <pre>. A false positive mangles a server's plain
 * output, which is worse, so a single stray `*` or `-` is never enough: either
 * one unambiguous structural signal, or two independent weak ones.
 */

/** Servers that declare their mime type get believed, both ways. */
const MARKDOWN_MIME = /^text\/(x-)?markdown|^application\/(x-)?markdown/i

const STRUCTURAL = {
  /** `# Heading` — needs the space, so `#tag` and `#1` don't count. */
  heading: /^ {0,3}#{1,6}[ \t]+\S/m,
  /** An opening fence. Closing is not required: truncated output is still markdown. */
  fence: /^ {0,3}(`{3,}|~{3,})/m,
  bullet: /^ {0,3}[-*+][ \t]+\S/gm,
  ordered: /^ {0,3}\d{1,9}[.)][ \t]+\S/gm,
}

const WEAK = {
  /** `| --- | :-- |` — a table's delimiter row, which prose never contains. */
  tableDelim: /^ {0,3}\|?[ \t]*:?-{2,}:?[ \t]*(\|[ \t]*:?-{2,}:?[ \t]*)+\|?[ \t]*$/m,
  quote: /^ {0,3}>[ \t]/gm,
  rule: /^ {0,3}([-*_])[ \t]*(?:\1[ \t]*){2,}$/m,
  code: /`[^`\n]+`/g,
  bold: /\*\*[^\s*][^*]*\*\*|__[^\s_][^_]*__/g,
  link: /\[[^\]\n]*\]\([^)\s]+(?:[ \t]+"[^"]*")?\)/g,
}

function count(text: string, re: RegExp): number {
  // The /g regexes are module-level and therefore stateful; matchAll requires /g
  // and does not mutate lastIndex, so it is the safe way to reuse them.
  return [...text.matchAll(re)].length
}

/**
 * `mime` is the server's declaration where there is one (resources carry it;
 * tool results never do). An explicit non-markdown mime vetoes the heuristic —
 * a server that says `text/plain` gets taken at its word.
 */
export function looksLikeMarkdown(text: string, mime?: string): boolean {
  if (mime !== undefined) {
    if (MARKDOWN_MIME.test(mime)) return true
    // Only text/* is a candidate at all, and text/plain means what it says.
    if (!/^text\//i.test(mime) || /^text\/plain/i.test(mime)) return false
  }

  const trimmed = text.trim()
  if (trimmed.length < 3) return false

  // Pretty-printed JSON has already been produced upstream by prettyIfJson and
  // is full of quotes and braces, not markdown. Never re-read it as prose.
  if (/^[[{]/.test(trimmed)) {
    try {
      JSON.parse(trimmed)
      return false
    } catch {
      // not JSON after all — carry on
    }
  }

  if (STRUCTURAL.heading.test(text)) return true
  if (STRUCTURAL.fence.test(text)) return true
  if (count(text, STRUCTURAL.bullet) >= 2) return true
  if (count(text, STRUCTURAL.ordered) >= 2) return true

  let weak = 0
  if (WEAK.tableDelim.test(text)) weak += 2 // a delimiter row is all but conclusive
  if (count(text, WEAK.quote) >= 2) weak++
  if (WEAK.rule.test(text)) weak++
  if (count(text, WEAK.code) >= 2) weak++
  if (count(text, WEAK.bold) >= 1) weak++
  if (count(text, WEAK.link) >= 1) weak++
  return weak >= 2
}
