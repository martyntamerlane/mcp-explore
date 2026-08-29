# CLAUDE.md - mcp-explore

## Project Overview

A public, shareable static web app: a user inputs the URL of their MCP server and the app connects **directly from the browser** (no backend, ever — see design spec) and displays its tools, resources, prompts, and capabilities as an interactive SVG graph with a slide-in detail panel.

> **Status**: Built and live at <https://martyntamerlane.github.io/mcp-explore/> (2026-08-29). The current design is the tool-first workspace — [`docs/specs/2026-08-29-tool-first-workspace.md`](docs/specs/2026-08-29-tool-first-workspace.md) — with its visual system in [`2026-08-29-visual-system-tightening.md`](docs/specs/2026-08-29-visual-system-tightening.md) as amended by [`2026-08-29-reading-pass.md`](docs/specs/2026-08-29-reading-pass.md) (one measure, four type voices, pinned faces). Superseded specs carry banners saying what still stands. The founding rationale (zero backend, browser-direct, no graph libraries) is still [`docs/specs/2026-08-24-initial-design.md`](docs/specs/2026-08-24-initial-design.md) — read both before making architectural decisions.

For feature behaviour see [`docs/functional-description.md`](docs/functional-description.md). For system topology and project structure see [`docs/architecture-overview.md`](docs/architecture-overview.md).

## Tech Stack

- **Frontend**: React 19, Vite, **TypeScript**, CSS Modules
- **MCP**: official `@modelcontextprotocol/sdk` client in the browser — Streamable HTTP with auto-fallback to legacy HTTP+SSE
- **Graph**: hand-rolled SVG with computed polar layout. No graph libraries, no physics, no draggable nodes (deterministic layout — lesson from meal-planner ISSUE-102)
- **Testing**: Vitest, RTL + jsdom, Playwright (three-tier, see Testing)
- **Hosting**: GitHub Pages via GitHub Actions, deployed on push to main

> **Deliberate divergence from meal-planner**: this project uses TypeScript. It's a typed-protocol client wrangling JSON Schemas and protocol unions — exactly where TS pays for itself. Don't suggest converting to plain JS for consistency.

## How to Run

```bash
npm install
npm run dev          # dev server
npm test             # Tier 1 (Vitest, <5s)
npm run build        # typecheck + production build
```

> **WSL gotcha**: Vite's file-watching is unreliable on `/mnt/c` (drvfs) — after source edits, restart `npm run dev` before judging results in a browser, or you may be served stale code.

## Implementation Guidelines

### Approach

- **These rules are living.** When Claude knows a better practice than one written here, it should say so and propose a change — never silently follow a rule it believes is wrong, and never silently deviate from one either.
- **At the start of each session**, read and present `TODO.md` and `ISSUES.md` in the terminal. Ask the user whether they'd like to tackle any open items before starting new work.
- **Always plan before implementing.** Discuss the approach before making significant changes, even for medium-sized tasks.
- Read and understand existing code before modifying it. Don't propose changes to code you haven't read.
- Keep solutions simple and focused. Only make changes that are directly requested or clearly necessary.

### Code Style

- TypeScript throughout. Let the MCP SDK's types flow; avoid `any` at protocol boundaries — model unknown server data as `unknown` and narrow.
- React functional components with hooks. No class components. State via Context + hooks; no external state libraries.
- Use existing patterns as reference — match the style of surrounding code.

### Visual Consistency

- The visual system lives in `docs/specs/` once designed. Follow it without asking. **Confirm with the user only when introducing a new visual pattern** — a component type, colour role, or interaction not yet covered by the system.
- **Audit ALL instances when changing a component's appearance.** Search the codebase for every place that component type appears and update them all. Never fix just the instance the user pointed out.
- **Theme-ready** — Use CSS custom properties for all colours. Never hardcode colour values.

### Testing

- Three-tier strategy: **Tier 1** unit (Vitest — protocol handling, layout math, parsing; run after every change, <5s), **Tier 2** component (RTL + jsdom; before deploys), **Tier 3** E2E smoke (Playwright against the built-in demo server, no external network; before deploys).
- Skip testing for trivial changes (copy tweaks, CSS-only edits) where tests wouldn't catch anything meaningful.
- Add tests gradually for new features when it makes sense. Don't retrofit tests onto existing code unless asked.

## Documentation

`docs/` is a first-class deliverable and must stay in sync with the code. **Update the relevant doc as part of the same change, not as a follow-up.** Routing:

- Feature behaviour / UX → `docs/functional-description.md`
- System topology, data model, project structure, routes, infra, env vars → `docs/architecture-overview.md`
- Design explorations and decisions → `docs/specs/` (dated files, e.g. `2026-08-24-initial-design.md`)
- Implementation plans → `docs/plans/` (dated files)
- **Interactive HTML pages** (user-requested visualizations of the code/architecture) → `docs/interactive/`. Each page must be fully self-contained (inline CSS/JS, no external CDNs or network calls) so it opens from the filesystem. When code changes make a page stale, update it in the same change or flag the staleness to the user.
- Rules and behaviour-changing instructions for Claude → `CLAUDE.md`. It is loaded into every conversation — keep it lean; resist dropping feature paragraphs in here.

### TODO.md / ISSUES.md conventions

- Every entry gets a stable ID (`TODO-N` / `ISSUE-N`) that is never reused, so links keep resolving.
- TODO entries carry a complexity tag: S (<1 session), M (1–2 sessions), L (multiple sessions). Completed items move to a Completed section at the bottom, preserving their IDs.
- ISSUE entries record: Discovered (date + how), Status, Severity, Description, Root cause, Fix — root cause is written down even for small bugs; it's the most valuable part later.

## What to Do

- Keep docs in sync with code changes (see Documentation above).
- **Pushing to main is a deploy** once GitHub Pages is live — the Actions workflow publishes automatically. Ask before pushing to main, and log each release to `DEPLOYMENTS.md`: date, what shipped, status, note.

### Security

- **Everything returned by a user-supplied MCP server is untrusted input** — tool names, descriptions, JSON schemas, resource contents, prompt text, error messages. Never render any of it as raw HTML (`dangerouslySetInnerHTML`) and never eval it; escape/sanitize at the render layer.
- **Auth headers/tokens never go in URLs.** Shareable links carry only the server URL. Tokens live client-side only (localStorage with an opt-out) and are sent only to the user's own MCP server.
- **No backend, ever, without a design discussion.** The zero-backend architecture is what makes SSRF and token-custody a non-issue; adding any server-side fetch/proxy reopens both and requires a spec.

## What to Avoid

- **Always flag cost implications before implementing.** Any change that introduces paid resources or third-party APIs must be explicitly called out and approved before implementation, even if it was part of a user-provided plan. Categorise: negligible (<$1/month), notable ($1–10/month), significant (>$10/month).
- **Never deploy or modify cloud infrastructure without explicit confirmation.**
- **Never commit or expose secrets** (API keys, tokens, credentials).
- Don't over-engineer. No premature abstractions, unnecessary error handling for impossible scenarios, or feature flags.
- Don't add dependencies without justification. Keep the bundle small.
