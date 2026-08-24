# TODO — mcp-explore

Future enhancements and ideas. Complexity: S (small, <1 session), M (medium, 1–2 sessions), L (large, multiple sessions).

Each entry has a stable ID (`TODO-N`) that is never reused. Completed items move to the [Completed](#completed) section at the bottom, preserving their IDs so old links keep resolving.

---

## Deferred from initial design (2026-08-24)

### TODO-1: Tool calling with schema-driven forms

**Complexity**: L

The v2 flagship. Generate argument forms from each tool's JSON Schema, invoke the tool, render results inline in the detail panel. Deliberately excluded from v1 (design spec decision #5) because form generation from arbitrary JSON Schema is the single biggest feature in the app.

### TODO-2: OAuth 2.1 authentication flow

**Complexity**: L

The MCP spec auth: protected-resource metadata discovery, dynamic client registration, PKCE, redirect handling, token refresh. Unlocks commercial remote servers (Linear, Sentry, etc.). v1 covers token-style auth via the custom-headers box only.

### TODO-3: stdio local bridge

**Complexity**: M

A small npx-distributed companion that exposes a local stdio MCP server over localhost HTTP (with CORS headers) so the hosted page can visualize it. Separate deliverable to build, version, and support.

### TODO-4: Semantic grouping in the graph — possible paid feature

**Complexity**: M

Group tools by shared prefix/namespace (`issues_create`, `issues_list` → `issues`) or by semantic similarity, adding a collapsible intermediate ring so 80-tool servers show ~8 tidy groups. v1 ships a flat ring (design spec decision #8). **Monetization note**: if this becomes a paid feature it needs an entitlement mechanism — a license-key check or a small auth'd API — which reopens the zero-backend decision; see design spec decision #9. Keep the layout code's grouping seam clean but build no entitlement machinery until this is a real goal.

### TODO-5: Light theme

**Complexity**: S

v1 is dark-first. All colours are already CSS custom properties, so this is a variable set + toggle honouring `prefers-color-scheme`, plus visual QA.

### TODO-6: Docs-style list view as alternate to the graph

**Complexity**: M

A switchable master-detail (sidebar + detail pane) view over the same data, for users who want scanning/searching over spatial browsing. Only worth it if the graph alone proves insufficient.

### TODO-7: Opt-in CORS proxy

**Complexity**: M

For servers that don't send CORS headers. Requires serious SSRF hardening (private-IP blocking, DNS-rebinding defense), infrastructure, cost exposure, and a token-custody trust story — which is why v1 is browser-direct only with a CORS diagnostic panel instead. Revisit only if CORS-blocked servers turn out to be a major share of real usage.

### TODO-8: Code-split the MCP SDK bundle

**Complexity**: S

`npm run build` warns the main chunk exceeds 500 kB because `@modelcontextprotocol/sdk` is bundled eagerly. Split it (dynamic import at the connect boundary or Vite `manualChunks`) when the real UI lands and load behaviour starts mattering. From final review of the 2026-08-24 scaffold branch.

### TODO-9: Connection-layer hardening

**Complexity**: S

Deferred Minors from the 2026-08-24 scaffold branch final review, best done when their consumers appear (graph UI / CORS diagnostics plan):
- Cap `listAll` pagination (`MAX_PAGES` + repeated-cursor detection) — a malicious server returning the same cursor forever hangs the tab (`src/mcp/connect.ts` cursor loop).
- Tag `ConnectFailure.attempts` with a `phase: "connect" | "snapshot"` field so the diagnostics panel can distinguish transport failures from mid-listing application errors.
- Allowlist `http:`/`https:` schemes in `connectUrl` before shareable `?server=` URLs and clickable recent-servers exist.
- Wrap `connectDemo`'s `close()` in try/finally so a client-close failure can't leak the server side.
- Assert `attempts[1].error` text in the both-transports-fail test.

---

## Completed

*(None yet.)*
