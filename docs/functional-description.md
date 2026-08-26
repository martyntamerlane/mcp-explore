# Functional Description — mcp-explore

> **Status**: v1 UI shipped 2026-08-25 (see [`docs/specs/2026-08-25-visual-identity.md`](specs/2026-08-25-visual-identity.md), extending [`docs/specs/2026-08-24-initial-design.md`](specs/2026-08-24-initial-design.md)). This describes actual behaviour — update it in the same change as any feature work.

## Concept

A public, shareable web page. A user inputs the URL of their MCP server; the page connects directly from their browser and displays the server's tools, resources, prompts, and capabilities as an interactive graph — pleasing and simple.

## v1 features (built)

- **Landing screen** (`ConnectScreen`) — hero copy, a server URL input, and a collapsed "Add headers" disclosure that reveals repeatable name/value rows for custom headers (e.g. `Authorization: Bearer …`) plus a "Remember headers on this device" opt-in. A recent-servers list (localStorage, `mcp-explore:recents`) offers one-click reconnect, only persisting headers when the user opted in at save time. "Try the demo" connects to the built-in in-page `demo-issue-tracker` server (4 tools, 2 resources, 2 prompts) over an `InMemoryTransport` — no network involved.
- **Connection + diagnostics** — Streamable HTTP with automatic fallback to legacy HTTP+SSE, via the official MCP SDK; only `http:`/`https:` URLs are accepted. On failure, a **connect-error panel** names the failed transports, explains the browser CORS requirement with the exact headers to add (`Access-Control-Allow-Origin`, `Access-Control-Allow-Headers`, `Access-Control-Expose-Headers: mcp-session-id`), notes the localhost local-network permission prompt, and offers a collapsed "Technical details" dump of the raw per-transport errors.
- **Graph view** (`Graph`) — deterministic polar SVG layout: server node at the origin, one hub per category (tools / resources / prompts) at a fixed angle, items fanned across concentric rings behind each hub. No physics, no dragging. Zoom (buttons, scroll wheel) and pan (drag the background) via an SVG transform; a filter box dims (does not hide) non-matching items. **Labels appear on demand** — leaf labels are invisible by default and fade in on hover, keyboard focus, or selection, keeping the resting graph uncluttered. Nodes are keyboard-operable (`Tab` + `Enter`/`Space`) and shape-coded by kind (circle = tool, rounded square = resource, diamond = prompt) so colour is never the only signal.
- **Detail panel** (`DetailPanel`) — slides in on node click. Tools show an arguments table (name, type, required marker, description, enum chips, default value) derived from the JSON Schema. Resources show URI/mime type/description with a "Load contents" button that fetches on demand and renders text (pretty-printed if JSON), images (`data:` URI), or a "binary contents" notice; the fetch is not automatic. Prompts show their argument list. Every entity has a **raw JSON disclosure ladder** — collapsed `<details>` that renders the full object with a copy button only once opened, so the closed state never dumps untrusted JSON into the DOM.
- **Overview header** — server name (monospace), a `v{version}` chip, a transport chip (`streamable-http` / `sse` / `in-memory`), and a tools/resources/prompts count line; a Disconnect button tears the connection down and returns to the landing screen.
- **Shareable URLs** — connecting via a typed/recent URL writes `?server=<encoded url>` to the address bar with `history.replaceState`; loading that URL auto-connects. Auth headers are never persisted to the URL — only the server URL is encoded. Disconnecting clears the query string back to the bare path.

## Dune mode (easter egg)

A hidden alternate theme, documented in [`docs/specs/2026-08-24-dune-mode-design.md`](specs/2026-08-24-dune-mode-design.md). Entering the classic Konami code (`↑↑↓↓←→←→ba`) anywhere on the page toggles a full-session dune-palette reskin (persisted in `localStorage`, `mcp-explore:dune-mode`) — the landing screen, graph, and detail panel all pick up dune-direction CSS tokens with no component code changes, since every color already flowed through `var(--…)` custom properties. While active, the landing screen's background becomes a procedural "heighliner scene": a heighliner silhouette, a rotating central "galactic entity," and a ring of ten generative-art tiles (five algorithmic motifs, no AI-generated or external images). Clicking any button plays a capped departure animation into a ship whose hull shape, colors, and details are deterministically derived from the connect-target URL (seeded hash + PRNG — the same URL always produces the same ship). Entering the sequence again toggles it off.

Built as a fully isolated, self-mounting module (`src/dune/`) loaded via its own Vite entry script — see Architecture Overview for the module map and isolation rationale.

## Explicitly out of v1 scope

Tool calling (TODO-1), OAuth (TODO-2), stdio servers (TODO-3), grouping (TODO-4), light theme (TODO-5).

Baseline (non-dune) landing-page redesign for general usefulness/stickiness — deferred as a separate, not-yet-brainstormed piece of work (see TODO-15).
