import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

// Root cause of Fix 1 slipping through 8 individual task reviews: nothing enforced
// that the dune theme covers every color token the default theme defines. This test
// is that enforcement — it fails loudly, naming the missing token, if a future color
// token is added to global.css's :root block without a dune-direction equivalent.
//
// Reads both stylesheets straight off disk via Node's fs/path (see src/dune/node-shims.d.ts
// for the minimal ambient module declarations this needs — this project has no
// @types/node installed, and this fix wave's isolation constraint forbids adding it via
// package.json/tsconfig.json). This is fine under Vitest even with a jsdom test
// environment, since fs isn't a DOM API — Vitest itself runs under Node.

const here = dirname(fileURLToPath(import.meta.url))
const globalCss = readFileSync(join(here, "../global.css"), "utf-8")
const duneCss = readFileSync(join(here, "./theme.css"), "utf-8")

// Structural (non-color) tokens that don't need a dune equivalent — shared shape
// values, not palette. Plus the theme-neutral white/black-alpha tokens that are
// deliberately excluded (edges/node marks/code background read the same regardless
// of theme).
const ALLOWLIST = new Set([
  "--radius-s",
  "--radius-m",
  "--radius-l",
  "--mono",
  "--display",
  "--ease-hover",
  "--ease-panel",
  "--edge",
  "--node-core",
  "--node-ring",
  "--code-bg",
])

function extractRootTokens(css: string, rootSelectorPattern: RegExp): Set<string> {
  // Strip comments first — both files carry prose /* ... */ comments (e.g. this fix
  // wave's own contrast-validation notes) that can otherwise mention a "--token:"
  // by name in running text and be mistaken for a real declaration.
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "")
  const match = rootSelectorPattern.exec(withoutComments)
  if (!match) throw new Error(`Could not find the expected :root block in the CSS (pattern: ${rootSelectorPattern})`)
  const blockStart = match.index + match[0].length
  const blockEnd = withoutComments.indexOf("}", blockStart)
  const block = withoutComments.slice(blockStart, blockEnd)
  const names = new Set<string>()
  for (const propMatch of block.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) {
    names.add(propMatch[1])
  }
  return names
}

test("every color token in global.css's default :root block has a dune-theme equivalent", () => {
  const globalTokens = extractRootTokens(globalCss, /:root\s*{/)
  const duneTokens = extractRootTokens(duneCss, /:root\[data-theme="dune"]\s*{/)

  const missing: string[] = []
  for (const token of globalTokens) {
    if (ALLOWLIST.has(token)) continue
    if (!duneTokens.has(token)) missing.push(token)
  }

  expect(missing, `dune theme (src/dune/theme.css) is missing a color token override for: ${missing.join(", ")}`).toEqual([])
})
