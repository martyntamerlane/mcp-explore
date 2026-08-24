# Functional Description — mcp-explore

> **Status**: Designed, not yet built. This describes the agreed v1 (see [`docs/specs/2026-08-24-initial-design.md`](specs/2026-08-24-initial-design.md)). As features are built, this file becomes the living description of actual behaviour — update it in the same change as any feature work.

## Concept

A public, shareable web page. A user inputs the URL of their MCP server; the page connects directly from their browser and displays the server's tools, resources, prompts, and capabilities as an interactive graph — pleasing and simple.

## v1 features (designed)

- **Landing screen** — server URL input; an Advanced box for custom headers (e.g. `Authorization: Bearer …`); a recent-servers list (localStorage) with one-click reconnect; a "Try the demo" button running a built-in in-page simulated MCP server (no network required).
- **Connection** — Streamable HTTP with automatic fallback to legacy HTTP+SSE, via the official MCP SDK. On failure, a **CORS diagnostic panel** tells the server's developer exactly which headers to add.
- **Graph view** — SVG map: server node → category hubs (tools / resources / prompts) → flat ring of items. Deterministic layout, zoom/pan, search box that dims non-matches. No physics, no dragging.
- **Detail panel** — slides in on node click: human-readable schema rendering (arguments table with types/required/defaults/enums), clickable resources fetch and display their contents (text, JSON, images), prompt metadata. Raw-JSON toggle with copy button everywhere.
- **Overview header** — server name, version, capability badges, entity counts.
- **Shareable URLs** — `?server=…` in the query string; auth headers never in URLs.

## Explicitly out of v1 scope

Tool calling (TODO-1), OAuth (TODO-2), stdio servers (TODO-3), grouping (TODO-4), light theme (TODO-5).
