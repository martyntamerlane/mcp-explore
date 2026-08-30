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


### ISSUE-11: The handshake snippet let a link run commands on the reader's machine

- **Discovered**: 2026-08-30 — full-codebase security review. Not found by any test; the snippet had no test file at all.
- **Status**: Closed — fixed 2026-08-30 (same session, before the review was published).
- **Severity**: High. Arbitrary command execution on the visitor's machine, from a link.
- **Description**: `initializeCurl` built the "prove your server works" command by interpolating the server URL into a double-quoted shell string. The URL is the raw text that was typed — or that a `?server=` link supplied — and a shell expands `$(…)` inside double quotes, so `https://host/$(command)` became a live command substitution in a snippet the panel invites the reader to copy and paste. The full chain needed no other bug: a link auto-connected (see ISSUE-12) to a host the attacker controlled, that host answered the reachability probe but sent no CORS headers, the `cors-refused` verdict rendered `CorsRemedy`, and the poisoned command appeared under confident "here's how to verify your server" copy with a copy button beside it.
- **Root cause**: The URL was validated as a **URL** and then used as a **shell word**, and those are different alphabets. `new URL()` accepts `$`, `(`, `)`, `;`, `|` and `&` in a path and `href` percent-encodes almost none of them — verified: `https://evil.test/$(id)` survives parsing entirely intact. The double quotes read as protection but stop only word-splitting, not expansion. The same function already withheld the visitor's bearer token from the snippet on the grounds that it was one screenshot from a leak, so the risk of putting untrusted text on a command line had been considered — for the header value, and not for the URL beside it. **The general shape: crossing from one grammar into another needs an escape for the grammar you are entering, not a check against the one you are leaving.**
- **Fix**: `initializeCurl` normalises through `new URL().href` and wraps the result in POSIX single quotes, escaping any `'` as `'\''`. Single quotes suppress every expansion, so the quoting rather than the normalising is what carries the safety; both are applied because neither is sufficient alone. New `ConnectError.test.tsx` asserts that command substitution, backticks, pipes, semicolons, ampersands and embedded single quotes all stay inside one shell word, and that an unparseable URL is still quoted rather than dropped.

### ISSUE-12: A link connected to any server it named, before the visitor saw it

- **Discovered**: 2026-08-30 — full-codebase security review.
- **Status**: Closed — fixed 2026-08-30.
- **Severity**: Medium on its own; it was also the delivery vehicle for ISSUE-11.
- **Description**: `?server=` connected on arrival, unconditionally. A link from anywhere made the page fetch from a host the visitor never chose and then render whatever came back — server name, instructions, tool names and descriptions — as trusted-looking UI on the app's own origin, with any links in that attacker-authored markdown opening in new tabs. A failed attempt additionally sent a `no-cors` GET to the named host from the visitor's browser and IP.
- **Root cause**: The feature was designed around the honest case — someone shares a link to a server they use — and the URL was treated as the sharer's intent rather than as input from whoever composed the link. The header-handling in the same effect had already been reasoned about carefully and is *not* affected: saved headers are matched by exact URL, so a crafted link could never harvest a token. The gap was that "which server" got none of that suspicion while "which credentials" got all of it.
- **Fix**: `ConnectScreen` connects on arrival only when the URL is already in this device's recents — a server the visitor has demonstrably chosen before, which is the case sharing exists for. Anything else fills the address in, says so in a quiet line under the form, and waits for Connect. Verified in a real browser against the built app: a link to an unknown host now makes **zero** off-origin requests before the click.

### ISSUE-13: A server could freeze the tab with 50 KB of markdown

- **Discovered**: 2026-08-30 — full-codebase security review; measured, not inferred.
- **Status**: Closed — fixed 2026-08-30.
- **Severity**: Medium (availability). No data exposure.
- **Description**: `"# Report\n\n" + "~~ ".repeat(n)` — a heading to pass the markdown detector, then unmatched markers — blocked the main thread for **4.9 s** at exactly the app's own 50,000-character display cap. Scaling was cleanly quadratic (4× the time for 2× the input). The result outline parses the same text a second time, and `Markdown` re-parsed on every render, so the real cost was a multiple of that.
- **Root cause**: `closingIndex` and `matchLink` both scan to the end of the string when there is nothing to find, and `parseInline` then advances one character and asks again — O(n²) whenever markers are unmatched. The `MAX_BLOCK_DEPTH` / `MAX_INLINE_DEPTH` limits already in the parser guard *recursion* depth, which is the blowup this kind of parser is expected to have; the scanning cost is a second, independent one that the depth limits do not touch. The 50,000-char cap was doing its job and was never the wrong size — it bounds bytes, and the cost here is superlinear in bytes.
- **Fix**: A scan budget in `parse.ts`, proportional to each top-level `parseInline` call's own input (8× length + 64) and shared by both scanners; when it runs out the remaining markers stay literal text, which is what an unmatched marker already renders as, so nothing a server sent is ever hidden. A budget rather than a length cap deliberately — a cap would send deepwiki's `read_wiki_contents` to a `<pre>`, and that long markdown is what the renderer exists for. Measured after: **5712 ms → 16 ms**, with output byte-identical on a 50,000-character legitimate document and on 20 edge cases. `Markdown` now memoises the parse as well.

### ISSUE-14: No Content-Security-Policy

- **Discovered**: 2026-08-30 — full-codebase security review, checking live response headers.
- **Status**: Closed — fixed 2026-08-30.
- **Severity**: Low (defence in depth — no known bypass depended on it).
- **Description**: The live site sent only `Strict-Transport-Security`, and `index.html` declared no policy. For an app whose entire purpose is rendering input from servers it does not trust, nothing constrained what a mistake in that rendering could reach.
- **Root cause**: GitHub Pages sends no security headers and offers no way to configure them, so the only available surface is a `<meta>` tag — easy to not think of, since headers are where CSP normally lives.
- **Fix**: A `<meta http-equiv="Content-Security-Policy">` in `index.html`: `script-src 'self'`, `object-src`/`frame-src`/`form-action` `'none'`, `base-uri 'none'`, `img-src`/`font-src` `'self' data:`, `style-src 'self' 'unsafe-inline'` (React style attributes), and `connect-src *` — which is not a lapse but the product: reaching a visitor's own server at any address is the whole app. `frame-ancestors` is deliberately absent and clickjacking therefore still unaddressed: it is ignored in a meta tag and Pages cannot send the header, so including it would only look like protection. Verified against a real build in a headless browser, which caught what review had not — Vite inlines small font subsets as `data:` URIs, so `font-src 'self'` alone blocked a woff2 face.

### ISSUE-15: A server could pin a tool as "running" for the rest of the session

- **Discovered**: 2026-08-30 — full-codebase security review.
- **Status**: Closed — fixed 2026-08-30.
- **Severity**: Low.
- **Description**: `callTool` set `resetTimeoutOnProgress: true` with no `maxTotalTimeout`. A server that emits a `notifications/progress` just inside the timeout keeps the call pending indefinitely, and the `inFlight` guard then refuses to run that tool again for the rest of the session.
- **Root cause**: `resetTimeoutOnProgress` is exactly right for its purpose — a server reporting progress should not be killed for taking a while — and it was enabled for that reason. What was missed is that it converts the timeout from a bound into a renewable lease, and a lease with no expiry is not a bound. The SDK provides `maxTotalTimeout` for precisely this and defaults it to unset.
- **Fix**: `maxTotalTimeout: MAX_TOOL_CALL_MS` (10 minutes) in `RunContext` — far beyond any real tool, and finite.

### ISSUE-16: The result outline was cramped beside hundreds of empty pixels

- **Discovered**: 2026-08-30 — user report against the live site on `read_wiki_contents`: "why is the far right panel… have such a narrow margin, when there's so much space to the right of it on my screen".
- **Status**: Closed — fixed 2026-08-30.
- **Severity**: Low (layout), but it made a navigation aid hard to scan.
- **Description**: The outline was a fixed 200px whose left and right edges sat at the same x-position on every screen from 1440 upward. Measured on the live site: the empty band to its right ran 95px at 1440, 575px at 1920, 1215px at 2560 and 2095px at 3440 — nearly three times the column's own width at 1920. Inside it, 22 of 49 entries wrapped onto two lines.
- **Root cause**: Two fixed pixel values with nothing between them and the viewport. The outline was `flex: 0 0 200px` inside a row capped at 1080px, and neither number responded to available width. The CSS comment recorded the calibration honestly — *"workspace 1140, content 780"* — which is exactly right at the 1440px screen it was tuned on and never revisited. The reading pass had already flagged the general case in its own §5: *"a genuinely wide 2560px display gains nothing from the extra room. Revisit if anyone reports it."* Someone reported it. **The general shape: a layout tuned at one viewport and expressed in constants is correct exactly once.**
- **Fix**: The column opens to 280px where there is room and shrinks to a 200px floor where there is not, and above the outline's own breakpoint the reading column stops shrinking so the shortfall comes out of the margin rather than out of the measure. Wrapping drops from 22 of 49 entries to 6, and 21 entries fit the screen instead of 14. Widths past 300 were measured and rejected: they buy single entries at real cost to the middle panel's dominance.

### ISSUE-17: The workspace is unusable on a phone

- **Discovered**: 2026-08-30 — headless capture at four widths while designing ISSUE-16's fix.
- **Status**: **Open — deferred by decision, 2026-08-30.** Recorded now so it is not rediscovered as a surprise. See TODO-32.
- **Severity**: High on mobile, none on desktop. The landing page is unaffected and renders well.
- **Description**: The browse column is a fixed 300px that never yields, so the workspace beside it gets **90px on a 390px phone** and 130px on a 430px one. In that sliver a tool name renders one character per line vertically down the whole screen, the description clips mid-word, and the argument form is off-screen. The columns never collapse — there is no mobile layout at all. The landing page, by contrast, stacks and reflows correctly.
- **Root cause**: The stage was specified as a two-column desktop workspace (browse column + workspace) and every spec since has refined that shape; no breakpoint was ever written where the two stop being side by side. The 300px column is not the bug so much as the absence of any width at which the layout changes form.
- **Fix**: Not yet done — deferred. The shape of it is a breakpoint below roughly 900px where the two columns stop sharing a row: either stacking them, or a list-then-panel flow with a way back, which is better to use but introduces a navigation step the desktop layout does not have. That is a design decision, not a mechanical fix.

### ISSUE-18: The CSP needs `'unsafe-eval'` because untrusted schemas become code

- **Discovered**: 2026-08-30 — connecting the built app to deepwiki behind the new CSP (ISSUE-14) failed with "Error compiling schema". The demo server does not exercise the path, so the earlier CSP verification missed it.
- **Status**: Open — mitigated. `'unsafe-eval'` is present so the app works; the better fix needs a dependency decision.
- **Severity**: Low as a CSP weakening; the underlying behaviour is the more interesting half.
- **Description**: `script-src 'self'` broke every server that declares an `outputSchema` on a tool. The SDK validates structured output against that schema, and its default validator is AJV, which compiles each schema into a JavaScript function with `new Function`.
- **Root cause**: A CSP was written against what the app's own code does, not against what its dependencies do at runtime. More to the point: **a JSON Schema from an untrusted server is turned into executable code in the visitor's browser**, which is a thing this project's threat model would never have accepted had it been visible. AJV's own guidance is that schemas from untrusted sources should not be compiled. It is not a known exploit — AJV 8 is hardened and the risk is theoretical — but it is the one place where untrusted input reaches a code generator, and the CSP is what surfaced it.
- **Fix**: Interim — `'unsafe-eval'` in `script-src`, documented in `index.html` as being there under protest. `'self'` still blocks the classic vector: no injected markup can load or inline a script. The real fix is to pass the SDK a `jsonSchemaValidator` that interprets rather than generates — `@cfworker/json-schema` (which the SDK already ships a provider for) or a small one of our own — which would remove the code generation and let the policy drop back to plain `'self'`. Needs a dependency decision; see TODO-33.

### ISSUE-19: The outline was legible but stranded

- **Discovered**: 2026-08-30 — user report after ISSUE-16's fix was merged and deployed: "the rightmost pane still looks off".
- **Status**: Closed — fixed 2026-08-30.
- **Severity**: Low (composition).
- **Description**: ISSUE-16 made the outline readable — 6 of 49 entries wrapping instead of 22 — and left it looking marooned. Measured on the deployed site at 1920: **32px between the outline and the text it indexes, and 495px between the outline and the edge of the screen.** A column with fifteen times more space on one side than the other reads as pushed aside rather than placed.
- **Root cause**: ISSUE-16 was diagnosed as a *sizing* problem and fixed as one; it was also a *placement* problem, and only the first half was addressed. The row holding the reading column and the outline is capped, and a capped row that is left-anchored puts every pixel it does not use on one side. Below about 1520px this is invisible because the row still fills the workspace — measured 33/32 at 1380 and 1440 — so the defect only exists above the width where the cap starts binding, which is the same blind spot ISSUE-16 had. **The general shape: fixing what was measured is not the same as fixing what was reported. The report said "so much space to the right of it" and the measurement said the entries wrap; both were true and only one was acted on.**
- **Fix**: The row centres itself when it holds an outline, so the two margins match — measured 265/264 at 1920, 585/584 at 2560, 1025/1024 at 3440, and unchanged at 1380/1440 where there was never a gap to close. Deliberately not applied when there is no outline: there the single column has already widened to take the space (ISSUE-16's wide blocks), and centring it would only unmoor the reading text from the browse column beside it. Alternatives were rendered and compared rather than argued: pushing the outline to the right edge, and letting the gap grow, both put a 440–495px hole in the middle of the page, which is worse than the margin they remove.
