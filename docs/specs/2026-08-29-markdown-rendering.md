# Rendering markdown results — design

> **Partly superseded 2026-08-29** by [`2026-08-29-reading-pass.md`](2026-08-29-reading-pass.md):
> block-level HTML from a known tag list is now dropped rather than printed as
> text, and the rendered type is on a two-tier heading scale with unchipped
> inline code. The parser's contract — data out, never markup — is unchanged.

**Date**: 2026-08-29
**Status**: implemented
**Refines**: the result surfaces in [`2026-08-29-tool-first-workspace.md`](2026-08-29-tool-first-workspace.md) §6 and the block rendering in [`2026-08-27-rail-browser-redesign.md`](2026-08-27-rail-browser-redesign.md) §2. The security posture in [`2026-08-24-initial-design.md`](2026-08-24-initial-design.md) is unchanged and constrains everything below.

## 1. Why

A large share of what MCP servers return is markdown. deepwiki's `ask_question` answers in headings, lists and inline code; Hugging Face and Cloudflare's docs tools do the same; the demo server's own resources are declared `text/markdown`. All of it was rendering as a monospace `<pre>` wall, which is exactly the shape the tool-first workspace was meant to get away from.

## 2. Decisions

1. **Detect, don't assume.** A text block is rendered as markdown only when the server declares it or the text looks like it. Everything else keeps the verbatim `<pre>` it always had.
2. **Hand-rolled parser and renderer, no dependency.**
3. **The parser emits data, never HTML.**
4. **Remote images are never loaded.**
5. **Detection is always reversible** — one click returns the exact bytes.

### 2.1 Why not react-markdown

`react-markdown` + `remark-gfm` is the obvious choice and was rejected on two grounds. It adds roughly 40 kB gzip to a bundle already over Vite's warning limit and carrying an open TODO to code-split (TODO-8). More importantly, it *has* a raw-HTML path that has to be configured off; a parser whose output type contains no HTML cannot emit any, however hostile its input. That is a structural guarantee rather than a configuration one, which is the right trade when every byte of input comes from a server the user is inspecting precisely because they don't yet trust it.

The cost is fidelity: this is a subset, not CommonMark. Reference links, setext headings, HTML blocks, footnotes and loose/tight list nuances are not implemented and degrade to plain text. If that becomes a real complaint, `parse.ts` and `Markdown.tsx` are the only two files a library swap touches — the seam was drawn there deliberately.

## 3. Detection (`markdown/detect.ts`)

False positives are the expensive failure. Leaving markdown unrendered costs nothing; mangling a server's plain output is a visible bug. So:

- **A declared mime wins, both ways.** `text/markdown` renders. `text/plain`, `application/json` or any non-`text/*` type vetoes the heuristic outright. Resources carry a mime (now threaded through `ReadBlock.mime`); tool results never do, so they are heuristic-only.
- **JSON is never markdown.** Text that starts with `{`/`[` and parses is excluded before anything else — `{"glob": "**/*.ts"}` would otherwise read as bold.
- **One structural signal is conclusive**: an ATX heading, a code fence, or two or more list items of the same kind.
- **Otherwise two independent weak signals** are required, from: a GFM delimiter row (worth two on its own), two blockquote lines, a thematic break, two code spans, a bold run, a link.

A single `- ` or a lone `*` never triggers: `"Config parsed - no errors found"` and `"3 * 4 * 5 per second"` stay plain.

## 4. The escape hatch

Any block rendered as markdown carries a **Show raw** control that swaps in the verbatim `<pre>`. Detection is a heuristic over adversarial input and will sometimes be wrong; when it is, nothing is hidden and the fix is one click. This reuses the existing `.ghostButton` (the raw-JSON Copy control's look), so it introduces no new component type.

Error blocks are never parsed as markdown. An error should read exactly as the server sent it.

## 5. Security

Everything here is untrusted input, and the rules from the initial design apply without exception.

- **No `dangerouslySetInnerHTML`, anywhere.** The parser's output type (`Block`/`Inline`) has no HTML in it. HTML in the source — `<img src=x onerror=…>`, `<b>` — is text, and renders as text.
- **Link destinations are allowlisted** to `http:`, `https:` and `mailto:`. Every other scheme (`javascript:`, `data:`, `vbscript:`), protocol-relative `//host`, and relative paths are refused. Relative paths matter: they would resolve against *our* GitHub Pages origin, not the server's. A refused link keeps its label text and simply isn't clickable.
- **Links carry `rel="noopener noreferrer nofollow"`** and open in a new tab.
- **Images are never `<img>`.** Loading `![](https://tracker.example/pixel.png)` would send this visitor's IP and a referrer to a third party chosen by the server under inspection — a tracking beacon triggered by looking at a tool's output. Image syntax renders as a marked link the user may follow deliberately. The existing `data:` URI path for resource image *blobs* is untouched: those bytes already arrived over the MCP connection and reach no new host.
- **Bounded work.** Block nesting stops at 6 and inline nesting at 4; beyond that content degrades to text. Input is already capped at 50,000 characters upstream, so parse time is bounded.

## 6. Presentation

Rendered markdown uses the app's own scale (`docs/specs/2026-08-29-visual-system-tightening.md`), not browser defaults, so a server's document cannot shout over the workspace's hierarchy:

- Headings map `#` → `<h3>`, since the workspace's subject is the `<h2>`. All levels share `--fs-body` at weight 600 — the outline is carried by weight and spacing, not six competing sizes.
- The container is capped at `--measure-prose`; tables scroll inside their own `overflow-x` wrapper rather than widening the page.

## 7. Verification

39 unit and component tests in `src/ui/markdown/`, plus two round-trip tests in `DeckView.test.tsx` (a `text/markdown` resource renders as a heading and the raw bytes return on click; a JSON result gets no markdown affordance at all). The security cases — `javascript:` links, HTML in source, remote images, unsafe image sources — are asserted at the DOM level, not just on the tree.

Confirmed live against `https://mcp.deepwiki.com/mcp`: `ask_question` returns markdown that now renders as headings, prose and lists with inline code, where it was previously a single monospace wall.
