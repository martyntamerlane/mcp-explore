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

### ISSUE-7: The result outline never appeared — it gated its own measuring node

- **Discovered**: 2026-08-29 — headless verification of the S4 outline against the live site; the outline was absent at 1440 and 1920 while 76 headings with correct ids sat in the DOM.
- **Status**: Closed — fixed 2026-08-29 (same session, before shipping).
- **Severity**: High for the feature — it was 100% non-functional in a browser while every unit test passed.
- **Description**: `Outline` rendered nothing at any viewport width. The headings were present and correctly slugged, the workspace was marked as the scroller, and the derived entries were correct; the component simply never showed.
- **Root cause**: A chicken-and-egg between rendering and measuring. `Outline` measures which of its entries actually exist in the document by reading `ref.current.closest("[data-scroller]")` from an effect — and it returned `null` from render until that measurement had produced at least one present id. Returning `null` means no DOM node, so the ref stayed `null`, so the effect bailed on its first line, so the measurement never ran, so it returned `null` forever. Nothing threw and nothing logged. It could not be caught by the unit tests either, because those render the component with its headings already in a container and jsdom happily reports them — the failure needs the real mount ordering to show up. **General shape: a component that decides whether to exist based on something it can only learn from its own mounted node can never come into existence.**
- **Fix**: The element stays mounted whenever the result has entries and marks itself `data-empty` instead of unmounting, so the ref is always live and re-measurement can bring it back (which is also what makes it recover when a block is toggled off "Show raw"). The width media query is written `.outline:not([data-empty])` rather than using the `hidden` attribute, because an author rule on `.outline` beats the UA stylesheet's `[hidden] { display: none }`. Recorded in `docs/specs/2026-08-29-result-outline.md` §3.

### ISSUE-8: A deep-linked subject arrived without the keyboard highlight

- **Discovered**: 2026-08-29 — headless verification of the S1 deep link; the tool opened in the workspace and was `aria-current` in the column, but nothing carried `data-active`, so the first ↓ restarted from the top of the list instead of continuing from the subject.
- **Status**: Closed — fixed 2026-08-29 (same session, before shipping).
- **Severity**: Low (navigation still worked, just from the wrong place).
- **Description**: With `?server=…&tool=NAME`, `BrowseColumn` mounted with a selection already set. An effect syncs the highlight to the selection, and it ran with the right value — but the highlight was null immediately afterwards.
- **Root cause**: Two effects both fire on mount, and the later one wins. `useEffect(… , [selection])` set the highlight to the selected row; `useEffect(() => setActiveKey(null), [segment])` — written to clear the highlight when the user switches list — also fires on mount, because a dependency array does not mean "on change only", it means "on mount and on change". Declared second, it ran second and cleared what the first had just set. **The rule: an effect whose purpose is "when the user changes X" is not the same as "when X differs from last render", and on mount those two disagree.**
- **Fix**: The reset moved onto the segment button's own `onClick`, which is where the intent actually lives — no mount pass, no ordering to reason about. A regression test in `App.test.tsx` asserts the deep-linked row carries `data-active` and that ↓ continues from it, which the DeckView-level test could not cover because it selects after mount.

### ISSUE-9: The connect-error panel told every failure it was a CORS problem

- **Discovered**: 2026-08-30 — reviewing the CORS-proxy handover (`docs/external-sources/HANDOVER-mcp-explore-cors-proxy.md`); reading `ConnectError.tsx` to plan the fallback showed the panel never inspects what actually failed.
- **Status**: Closed — fixed 2026-08-30 (`docs/specs/2026-08-30-connection-diagnostics.md`).
- **Severity**: Medium — wrong advice on every failure that wasn't CORS, and it hid the one control that would have fixed the commonest of them.
- **Description**: `ConnectError` rendered the same hint block for every `ConnectFailure`: a paragraph about cross-origin requests and a snippet of `Access-Control-*` headers to add. A typo'd hostname, a `401` from a server that wanted a token, a `404` from a pasted base URL, a `500`, an offline browser and a plain website URL all got told to fix their CORS configuration. The headline — *"Couldn't reach this server over any supported transport"* — was itself false whenever the server had answered. A `401` was the worst case: the app has an "Add headers" box six inches above the panel, and never mentioned it.
- **Root cause**: The hint was **hardcoded rather than derived**. The panel was written when CORS was the only failure anyone had hit (ISSUE-1, the same week), so the then-universal explanation was baked into the JSX and no branch was ever added. The evidence to do better was already being collected and thrown away: `ConnectFailure.attempts` carries each transport's error, and the SDK puts the HTTP status on `StreamableHTTPError.code`. **The general shape: a message that is right for every case you have seen becomes a lie the moment it is written as a constant instead of a function of the input.**
- **Fix**: `src/mcp/diagnose.ts` — a pure classifier over the attempts, the URL and the environment, returning one verdict. Statuses outrank opaque failures (reading any status is proof the browser was allowed to read the response, so CORS is not the problem); certain URL-shape cases (mixed content, a private/loopback host from a hosted page) are named precisely; and only the genuinely opaque bucket mentions CORS at all. Two verdicts now act rather than only explaining: `401`/`403` opens the headers disclosure and seeds an `Authorization` row, and a mixed-content verdict offers the `https://` twin. Also corrected in passing: the snippet said `Access-Control-Allow-Headers: *`, which the Fetch spec excludes `Authorization` from — anyone with an auth'd server who copied our advice stayed broken.

### ISSUE-10: A 200 was reported as "the server refused the request"

- **Discovered**: 2026-08-30 — live headless pass over the new diagnostics, pointing the app at `https://raw.githubusercontent.com/.../README.md` (a CORS-enabled host that serves plain text). Found before shipping; every unit test passed.
- **Status**: Closed — fixed 2026-08-30 (same session, before shipping).
- **Severity**: Low, but self-discrediting — the panel printed a sentence that cannot be true.
- **Description**: A URL that answered `200` with a non-MCP content type produced *"The server refused the request (HTTP 200). It answered, so the connection and the cross-origin checks are both working; the request itself was rejected."* The correct verdict was `not-mcp`.
- **Root cause**: Two mistakes that only combine outside jsdom. First, the classifier treated **any** readable status as a refusal, when only `>= 400` is one — a successful status that still failed the handshake means a response arrived and wasn't MCP. Second, the content-type check matched only the Streamable HTTP transport's wording ("Unexpected content type"); the legacy SSE transport says **"Invalid content type"** and, unlike its sibling, carries the real HTTP status (200) rather than the `-1` sentinel. So the SSE attempt slipped past the content-type branch and was caught by the status branch. Both transports were needed to reproduce it, and the fixtures had only ever modelled the streamable one. **The general shape: when two implementations report the same condition, testing against one of them tests the fixture, not the code.**
- **Fix**: `diagnose` treats a status as a refusal only at `>= 400`, and falls through to `not-mcp` for a successful status or either transport's content-type wording. Regression tests cover the SSE phrasing with its 200 and a 3xx. Re-verified live against the same URL after rebuilding.

