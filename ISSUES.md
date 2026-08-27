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
