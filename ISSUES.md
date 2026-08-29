# Known Issues

Each entry has a stable ID (`ISSUE-N`) that is never reused. Entries record: **Discovered** (date + how), **Status**, **Severity**, Description, Root cause, Fix. Write the root cause down even for small bugs — it's the most valuable part later.

---

### ISSUE-1: Cannot connect to mcpplaygroundonline.com servers — no CORS headers (external, not a bug)

- **Discovered**: 2026-08-25 — user report with screenshot (`docs/external-sources/CORS_cannot_connect_2026-08-25_065957.png`) after trying `https://mcpplaygroundonline.com/mcp-complex-server`.
- **Status**: Closed — working as designed (external server limitation).
- **Severity**: N/A (external).
- **Description**: Both transports fail with "Failed to fetch" and the app shows the CORS diagnostic panel.
- **Root cause**: The server is a functioning MCP endpoint (a curl `initialize` succeeds) but sends no `Access-Control-Allow-Origin` header on either the preflight or the POST response, so the browser blocks every cross-origin read before the app sees any data. The site's own playground client works because it connects same-origin. Verified the same day that the app connects fine to a CORS-enabled public server (`https://mcp.deepwiki.com/mcp`, streamable-http, graph rendered, no console errors) — the client stack is not at fault.
- **Fix**: None possible client-side; no browser-based client can reach a server that omits CORS headers. The server owner would need to send the headers the diagnostic panel lists. A first-party opt-in CORS proxy is [TODO-7](TODO.md) — deferred because it requires SSRF hardening, infrastructure cost, a token-custody story, and reopens the zero-backend decision.

### ISSUE-2: Tooltip stays pinned after a mouse click ("helptext doesn't disappear")

- **Discovered**: 2026-08-27 — user report during luminous-deck tweak session; reproduced headlessly (hover + click a tool, move mouse away — tip stays).
- **Status**: Closed — fixed 2026-08-27 (luminous-deck branch).
- **Severity**: Low (cosmetic, but reads as flaky UI).
- **Description**: After clicking a tool button or rail entry, its description tooltip stayed visible even when the pointer left the card, until focus moved elsewhere.
- **Root cause**: Tooltip visibility was bound to `.card:focus-within` as the keyboard-access path. A mouse click also focuses the button, and focus persists after the pointer leaves — so the "keyboard" selector kept the tip lit for mouse users. Classic hover/focus conflation: the correct keyboard signal is `:focus-visible`, which browsers suppress for pointer-initiated focus.
- **Fix**: `ToolButton.module.css` shows the tip on `.card:hover` and `.card:has(:focus-visible)` only. Rail tooltips were removed entirely by the rail-browser redesign (`docs/specs/2026-08-27-rail-browser-redesign.md`), which also solved their layout collision (tips covered the entries below).

### ISSUE-3: Open detail panel blocked clicks on the rail beneath it

- **Discovered**: 2026-08-27 — headless repro during the rail-browser redesign: with the panel open, Playwright could not click rail entries (`<aside>` intercepts pointer events); Escape did not close the panel either (known deferred gap, TODO-12).
- **Status**: Closed — resolved structurally by the rail-browser redesign.
- **Severity**: Medium (browsing resources required closing the panel after every look).
- **Description**: The panel slid in over the rail column, fully covering the Resources/Prompts lists it was opened from and swallowing their pointer events.
- **Root cause**: Panel and rail shared the same right-hand region: the panel is an absolutely-positioned right-side `<aside>` while the rail was the rightmost flex column, so any selection overlaid the list that produced it. A symptom of resources/prompts being routed through the tools' deep-dive surface at all.
- **Fix**: Rail moved to the left flank and became self-contained (in-place unfold, no panel involvement); the panel is tools-only and now slides over the grid's right edge, never the rail. See `docs/specs/2026-08-27-rail-browser-redesign.md`.

### ISSUE-4: Required `string | string[]` arguments demanded hand-written JSON

- **Discovered**: 2026-08-29 — live QA of the new input forms against `https://mcp.deepwiki.com/mcp`, before the work shipped.
- **Status**: Closed — fixed 2026-08-29 (same session, in `fix: live-QA fix wave`).
- **Severity**: Medium (a popular server's main tool was effectively unusable from the form).
- **Description**: `ask_question.repoName` on deepwiki is a **required** argument declared `anyOf: [string, string[]]`. The form rendered it as the raw-JSON fallback textarea, so running the tool meant typing `"owner/repo"` *with quotes* — anything else failed JSON parsing and blocked Run. The field users think of as "owner/repo" asked them to know JSON syntax.
- **Root cause**: `schemaRows`' `typeName` only looked at `type`. A property whose type lives in an `anyOf`/`oneOf` branch list has no `type` key, so it fell through to `"any"`, which `argValues` maps to the JSON fallback. The fallback itself is correct design — the bug was never resolving unions in the first place. "One or many of X" is a common shape in real MCP servers, so this was not an exotic edge case.
- **Fix**: `typeName` now resolves unions that have one honest answer — identical branches, `string | string[]` (the comma-separated list control satisfies the array branch), and `number | integer`. Mixed unions still get the JSON field, deliberately: better an explicit JSON box than a control that quietly drops a branch. Verified end to end against the live server — form filled in the browser, Run pressed, real answer returned.

### ISSUE-5: The browse column's width changed with the server

- **Discovered**: 2026-08-29 — measured during the visual audit of the live site; the flank rendered at 370px against Hugging Face (`https://huggingface.co/mcp`, 155 resources) and 300px against the demo server.
- **Status**: Closed — fixed 2026-08-29 (`docs/specs/2026-08-29-visual-system-tightening.md` §4).
- **Severity**: Low visually, but it undermined every layout decision downstream.
- **Description**: `BrowseColumn` is specified as a 300px flank. On servers with long tool/resource names it silently grew by up to 23%, taking that width from the workspace, so the app's proportions differed per server and no measure or gap could be tuned against a known canvas width.
- **Root cause**: `.column` declared `flex: 0 0 300px`, i.e. `flex-basis: 300px` with no shrink — but flex-basis is not a maximum. A flex item's `min-width` defaults to `auto`, which resolves to `min-content`, and `min-width` beats `flex-basis`. The row content's intrinsic minimum (a long name plus its glyph and count) therefore pushed the column wider. `.column` already carried `min-height: 0` for the scroll container; the horizontal twin was simply never added. The same trap is why `.row .name` already had `min-width: 0` — the fix was applied one level too deep.
- **Fix**: `min-width: 0` on `.column`. Verified: 300px against Hugging Face after the change.

### ISSUE-6: Resource URIs rendered in the browser's generic monospace

- **Discovered**: 2026-08-29 — during verification of the visual tightening, a computed-style sweep reported four font families where the design has three; the fourth was a bare `monospace` on one element.
- **Status**: Closed — fixed 2026-08-29.
- **Severity**: Low (cosmetic, invisible on any machine where the generic and `--mono` resolve alike).
- **Description**: The resource view's URI (`demo://config`) rendered in the browser's generic `monospace` rather than the app's `--mono` stack — a different typeface, weight and width from every other identifier on screen, varying by OS.
- **Root cause**: `Workspace.module.css .meta` sets `font-family: var(--mono)` on the wrapping `<p>` and the URI is a `<code>` child, so this looked like ordinary inheritance. It is not: the UA stylesheet declares `code, pre, kbd, samp { font-family: monospace }`, and an author-level rule on the *parent* loses to a UA rule on the *element itself* — inheritance only applies where no declaration matches. Nothing in the codebase had ever styled bare `code`/`pre`, so the one place a `<code>` was used without a class picked up the UA default. `.code` (the `<pre>` blocks) was unaffected only because it sets its own `font-family` directly.
- **Fix**: a global `code, pre, kbd, samp { font-family: var(--mono); font-size: inherit }` reset in `global.css`, so any future bare `<code>` inherits the intended face.
