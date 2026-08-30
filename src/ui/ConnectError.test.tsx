import { initializeCurl } from "./ConnectError"

/**
 * The handshake snippet is a command the panel asks the reader to paste into a
 * shell, built from a URL the reader did not necessarily choose — a `?server=`
 * link supplies one just as readily as the input box (ISSUE-11).
 */

/** Everything between the single quotes the snippet wraps the URL in. */
function quotedTarget(snippet: string): string {
  const m = /curl -i -X POST '((?:[^']|'\\'')*)'/.exec(snippet)
  if (m === null) throw new Error(`URL is not single-quoted in: ${snippet}`)
  return m[1]
}

test("an ordinary URL still reads as itself", () => {
  const snippet = initializeCurl("https://api.example/mcp")
  expect(snippet).toContain("curl -i -X POST 'https://api.example/mcp'")
})

test.each([
  ["command substitution", "https://evil.test/$(id)"],
  ["backticks", "https://evil.test/`id`"],
  ["a quote and a chained command", 'https://evil.test/mcp"; id; #'],
  ["a pipe to a shell", "https://evil.test/x|sh"],
  ["an ampersand", "https://evil.test/x&id"],
  ["a single quote, which single-quoting must escape", "https://evil.test/it's"],
])("%s cannot escape the quoting", (_label, hostile) => {
  const snippet = initializeCurl(hostile)

  // The shell sees one argument: nothing after the opening quote closes it
  // except the final quote. Any `'` inside must arrive as the `'\''` dance.
  const target = quotedTarget(snippet)
  expect(target.replaceAll(`'\\''`, "")).not.toContain("'")

  // And no metacharacter survives *outside* the quoted argument, where it would
  // be the shell's to interpret rather than curl's.
  const outside = snippet.replace(`'${target}'`, "")
  for (const meta of ["$(", "`", "|", "&", ";"]) expect(outside).not.toContain(meta)
})

test("a URL too malformed to parse is still quoted rather than dropped", () => {
  const snippet = initializeCurl("not a url $(id)")
  expect(quotedTarget(snippet)).toBe("not a url $(id)")
})
