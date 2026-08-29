# Luminous Deck Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute `docs/specs/2026-08-26-luminous-deck-redesign.md` — light-first "luminous precision" identity, the control-deck stage replacing the flow view, the scoped Run verb, choreography via `motion`, and the two-door landing.

**Architecture:** The deck is a new default stage behind the existing `StageProps` contract (`src/ui/stage.ts`). Pure logic (deck model, arm machine, result sanitizer) lives in plain TS modules with Tier-1 tests; run state lives in a React Context (`RunProvider`) owned by `App` so both the stage and `DetailPanel` see it without changing `StageProps`. The flow view (`src/ui/flow/`) is deleted; its data-shaping moves into `deckModel.ts`.

**Tech Stack:** React 19 + TypeScript + Vite, CSS Modules, `@modelcontextprotocol/sdk`, `motion@13` (approved 2026-08-26, negligible cost), `@fontsource-variable/inter` + `@fontsource-variable/geist` (bake-off; loser uninstalled), Vitest + RTL.

## Global Constraints

- **Branch base**: cut `feat/luminous-deck` from the tip of `feat/ui-v1` (b71900d), **not** `main` — the spec's "cut from main" predates the discovery that `main`/`origin/main` lack the 29 commits carrying `stage.ts`, `flowModel`, `DetailPanel`, and the flow view this spec builds on. No pushes anywhere until the one-reveal review (spec §10).
- **Parallel session**: never touch `src/dune/`. Stage files explicitly by path — never `git add -A`/`-u` (shared checkout, memory: parallel-sessions).
- **Dune token contract**: `src/dune/theme.test.ts` requires every colour token in the **first** `:root` block of `src/global.css` to exist in the Dune theme. Therefore: change token *values* freely, keep token *names*, add **no new colour tokens** to that block. New non-colour tokens (e.g. `--ui` font stack) go in the **second** `:root` block. Derived tints in component CSS use `color-mix()` on existing tokens — never raw colour literals (CLAUDE.md theme-ready rule).
- **Untrusted server data**: tool names, descriptions, schemas, results are all untrusted. React text nodes only; no `dangerouslySetInnerHTML`; no eval; cap rendered result size (`MAX_RESULT_CHARS = 50_000`).
- **Motion discipline**: CSS for static-state transitions (hover/focus/press); `motion` only for the five spec moments (power-on, arm/fire/result, panel, expand/collapse+filter, landing entrance). At rest the app is still. `<MotionConfig reducedMotion="user">` + CSS `@media (prefers-reduced-motion: reduce)` give the floors.
- **WSL**: restart `npm run dev` after source edits before judging in a browser.
- **Tests**: `npm test` after every task; `npm run build` (typecheck) before the review checkpoint. Commit per task.
- **Copy vocabulary**: canonical headers `Tools / Resources / Prompts` with glosses *actions it can perform* / *data it exposes* / *ready-made instructions* (retained).

## Validated light palette (spec §2 "record the validated set" — this is the record)

Derived 2026-08-26 with the dataviz six-check validator, mode `light`, surface `#f4f6fa`, `--pairs all` (any two glyphs can sit adjacent in the deck).

| Token | Value | Validation |
|---|---|---|
| `--bg` (canvas) | `#f4f6fa` | near-white cool, never pure white |
| `--tool` | `#0891b2` | fills: **ALL SIX CHECKS PASS** — lightness band ✓, chroma ≥0.10 ✓, CVD worst all-pairs ΔE 16.7 (deutan) / 17.8 (tritan), normal-vision floor 25.9, contrast ≥3:1 ✓ |
| `--resource` | `#b45309` | (same run) |
| `--prompt` | `#6d28d9` | (same run) |
| `--tool-bright` | `#155e75` | deep companion (darker-than-fill hover/edge, per spec) — 6.72:1 |
| `--resource-bright` | `#92400e` | 6.55:1 |
| `--prompt-bright` | `#5b21b6` | 8.30:1 |
| `--ink` | `#171b26` | 15.89:1 |
| `--ink-2` | `#4d5468` | 6.97:1 |
| `--ink-3` | `#666c82` | 4.81:1 (AA at small sizes — `#7a8098` failed at 3.62:1) |
| `--danger` | `#b91c1c` | 5.98:1 (`#dc2626` was 4.46:1 — below AA for small text) |

Notes: the old dark-mode cyan `#0891b2` happens to pass best on light (cyan-700 `#0e7490` FAILED chroma at 0.094); amber deepened 600→700, violet 500→700-family. `-bright` token *names* are kept for the Dune contract even though the light values are deep companions.

---

### Task 1: Branch + docs commit

**Files:**
- No source changes. Commits the pending grill-session doc sync.

- [ ] **Step 1: Cut the branch from the feat/ui-v1 tip**

```bash
git checkout -b feat/luminous-deck feat/ui-v1
```

- [ ] **Step 2: Commit the pending docs (explicit paths only)**

```bash
git add TODO.md docs/specs/2026-08-26-luminous-deck-redesign.md \
  docs/specs/2026-08-25-flow-view-design.md docs/specs/2026-08-25-visual-identity.md \
  docs/external-sources/dune_screenshot_homepage.png docs/external-sources/dune_screenshot_mcp.png \
  docs/external-sources/majestic_screenshot_bad.png \
  docs/plans/2026-08-26-luminous-deck-implementation.md
git commit -m "docs: luminous-deck redesign spec + implementation plan; supersede dark identity and flow view"
```

- [ ] **Step 3: Verify clean state**

Run: `git status --short` — expect nothing except possible parallel-session dune files (leave those untracked/unstaged).

### Task 2: Light identity — tokens, fonts, canvas

**Files:**
- Modify: `src/global.css` (both `:root` blocks, `body`)
- Modify: `src/main.tsx` (font import)
- Modify: `package.json` (via npm install)

**Interfaces:**
- Produces: CSS tokens with unchanged names, light values (table above); `--ui` font token in the second `:root` block. Every later CSS module consumes these.

- [ ] **Step 1: Install approved dependencies**

```bash
npm install motion @fontsource-variable/inter @fontsource-variable/geist
```

(`motion@13.1.1`, fonts `5.3.0` — verified on the registry 2026-08-26. Both faces installed for the bake-off; the loser is uninstalled in Task 11.)

- [ ] **Step 2: Rewrite `src/global.css`**

Replace the first `:root` block values (names unchanged; `--edge`/`--node-core`/`--node-ring` stay until the flow view dies in Task 7, re-derived so the interim app isn't invisible):

```css
:root {
  /* surfaces — luminous-deck redesign 2026-08-26 (light-first) */
  --bg: #f4f6fa;
  --glow-a: rgba(8, 145, 178, 0.07);
  --glow-b: rgba(109, 40, 217, 0.05);
  --panel: rgba(255, 255, 255, 0.6);
  --panel-border: rgba(23, 27, 38, 0.1);

  /* ink — text never wears entity colors */
  --ink: #171b26;
  --ink-2: #4d5468;
  --ink-3: #666c82;

  /* entity accents — validated 2026-08-26 (six checks, light, all-pairs; see implementation plan);
     "-bright" names kept for the dune token contract — values are DEEP companions on light */
  --tool: #0891b2;
  --tool-bright: #155e75;
  --resource: #b45309;
  --resource-bright: #92400e;
  --prompt: #6d28d9;
  --prompt-bright: #5b21b6;

  /* graph marks — retired with the flow view (Task 7); interim dark-alpha stand-ins */
  --edge: rgba(23, 27, 38, 0.07);
  --node-core: rgba(23, 27, 38, 0.06);
  --node-ring: rgba(23, 27, 38, 0.25);

  --danger: #b91c1c;
  --cta-gradient: linear-gradient(135deg, rgba(8, 145, 178, 0.1), rgba(109, 40, 217, 0.1));
  --code-bg: rgba(23, 27, 38, 0.05);
  --panel-solid: rgba(252, 253, 255, 0.92);
  --header-bg: rgba(244, 246, 250, 0.72);
  --radius-s: 8px;
  --radius-m: 12px;
  --radius-l: 16px;
  --mono: ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas, monospace;
  --ease-hover: 160ms ease-out;
  --ease-panel: 240ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
```

Second `:root` block gains the UI face (structural, non-colour — allowlist-safe):

```css
:root {
  --display: "Space Grotesk Variable", system-ui, -apple-system, "Segoe UI", sans-serif;
  --ui: "Inter Variable", system-ui, -apple-system, "Segoe UI", sans-serif;
}
```

`body`: background becomes the bright canvas with the two ambient tints (same structure, new tokens do the work); `font-family: var(--ui)`; keep font-size 15px and antialiasing. Add:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 3: Import the UI face in `src/main.tsx`**

```ts
import "@fontsource-variable/space-grotesk"
import "@fontsource-variable/inter"
```

- [ ] **Step 4: Run the suite — the dune parity test is the point**

Run: `npm test`
Expected: all pass (no token added/renamed in the first block ⇒ `src/dune/theme.test.ts` still green). Flow view looks wrong on light — expected, it dies in Task 7; do not polish it.

- [ ] **Step 5: Commit**

```bash
git add src/global.css src/main.tsx package.json package-lock.json
git commit -m "feat: light-first luminous identity — validated palette tokens, Inter UI face, bright canvas"
```

### Task 3: Deck model (TDD)

**Files:**
- Create: `src/ui/deck/deckModel.ts`
- Test: `src/ui/deck/deckModel.test.ts`

**Interfaces:**
- Consumes: `ServerSnapshot`, `TransportKind` (`src/mcp/types`), `EntityKind` (`src/ui/stage`).
- Produces (used by Tasks 7–8):

```ts
export type RunClass = "instant" | "arm" | "input-required"
export interface DeckTool { kind: "tool"; id: string; label: string; blurb?: string; runClass: RunClass }
export interface RailItem { kind: "resource" | "prompt"; id: string; label: string; blurb?: string }
export interface RailGroup { kind: "resource" | "prompt"; label: string; gloss: string; items: RailItem[] }
export type DeckEmphasis = "regular" | "tool-light"
export interface DeckModel { tools: DeckTool[]; rail: RailGroup[]; emphasis: DeckEmphasis }
export function requiredArgCount(schema: unknown): number
export function classifyTool(tool: Tool, transportKind: TransportKind): RunClass
export function buildDeckModel(snapshot: ServerSnapshot, transportKind: TransportKind): DeckModel
```

Semantics (spec §4–5): runnable ⇔ `transportKind === "in-memory"` (demo) OR `requiredArgCount(inputSchema) === 0`; runnable + `annotations.readOnlyHint === true` (runtime-narrowed, untrusted) ⇒ `"instant"`; runnable otherwise ⇒ `"arm"`; not runnable ⇒ `"input-required"`. Dedupe: exact duplicate `kind:id` entries are dropped (first wins — duplicate React keys otherwise, TODO-12). `emphasis: "tool-light"` when `tools.length <= 4` (adaptive-emphasis seam; CSS decides what it means; threshold judged from screenshots in Task 11). Blurb = first non-empty line of description (as `flowModel.firstLine` today); resource blurb falls back to its URI.

- [ ] **Step 1: Write failing tests** — `src/ui/deck/deckModel.test.ts` (vitest globals, no imports of test fns, matching house style). Cover:

```ts
import type { ServerSnapshot } from "../../mcp/types"
import { buildDeckModel, classifyTool, requiredArgCount } from "./deckModel"

const base: ServerSnapshot = {
  serverInfo: { name: "s", version: "1" },
  capabilities: {},
  tools: [],
  resources: [],
  prompts: [],
}
const tool = (name: string, extra: object = {}) => ({ name, inputSchema: { type: "object" as const }, ...extra })

test("requiredArgCount narrows untrusted schemas", () => {
  expect(requiredArgCount({ type: "object", required: ["a", "b"] })).toBe(2)
  expect(requiredArgCount({ type: "object" })).toBe(0)
  expect(requiredArgCount(null)).toBe(0)
  expect(requiredArgCount({ required: "not-an-array" })).toBe(0)
})

test("classify: zero-required + readOnlyHint => instant; zero-required => arm; required args => input-required", () => {
  expect(classifyTool(tool("a", { annotations: { readOnlyHint: true } }), "streamable-http")).toBe("instant")
  expect(classifyTool(tool("b"), "streamable-http")).toBe("arm")
  expect(classifyTool(tool("c", { inputSchema: { type: "object", required: ["x"] } }), "streamable-http")).toBe("input-required")
})

test("classify: every demo (in-memory) tool is runnable", () => {
  expect(classifyTool(tool("c", { inputSchema: { type: "object", required: ["x"] } }), "in-memory")).toBe("arm")
})

test("buildDeckModel groups rail with canonical glosses and dedupes duplicate ids", () => {
  const m = buildDeckModel(
    {
      ...base,
      tools: [tool("t1"), tool("t1")],
      resources: [{ uri: "r://1", name: "one" }, { uri: "r://1", name: "one again" }],
      prompts: [{ name: "p1", description: "line1\nline2" }],
    },
    "in-memory",
  )
  expect(m.tools.map((t) => t.id)).toEqual(["t1"])
  expect(m.rail[0].items.map((i) => i.id)).toEqual(["r://1"])
  expect(m.rail[0].gloss).toBe("data it exposes")
  expect(m.rail[1].items[0].blurb).toBe("line1")
})

test("emphasis flips to tool-light at <= 4 tools", () => {
  expect(buildDeckModel({ ...base, tools: [tool("a")] }, "in-memory").emphasis).toBe("tool-light")
  expect(buildDeckModel({ ...base, tools: [1, 2, 3, 4, 5].map((n) => tool("t" + n)) }, "in-memory").emphasis).toBe("regular")
})
```

- [ ] **Step 2: Run to verify failure** — `npm test -- deckModel` — expect module-not-found.
- [ ] **Step 3: Implement `deckModel.ts`** (port `firstLine` + gloss/label maps from `flowModel.ts`; do not import from `flow/` — it dies in Task 7):

```ts
import type { Tool } from "@modelcontextprotocol/sdk/types.js"
import type { ServerSnapshot, TransportKind } from "../../mcp/types"

/* types as in Interfaces block */

export function requiredArgCount(schema: unknown): number {
  if (typeof schema !== "object" || schema === null) return 0
  const required = (schema as { required?: unknown }).required
  return Array.isArray(required) ? required.filter((r) => typeof r === "string").length : 0
}

export function classifyTool(tool: Tool, transportKind: TransportKind): RunClass {
  const runnable = transportKind === "in-memory" || requiredArgCount(tool.inputSchema) === 0
  if (!runnable) return "input-required"
  return tool.annotations?.readOnlyHint === true ? "instant" : "arm"
}

function firstLine(text: string | undefined): string | undefined {
  const line = text?.split("\n").find((l) => l.trim() !== "")
  return line?.trim()
}

function dedupe<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)))
}

export function buildDeckModel(snapshot: ServerSnapshot, transportKind: TransportKind): DeckModel {
  const tools = dedupe(
    snapshot.tools.map((t) => ({
      kind: "tool" as const, id: t.name, label: t.name,
      blurb: firstLine(t.description), runClass: classifyTool(t, transportKind),
    })),
  )
  const rail: RailGroup[] = [
    { kind: "resource", label: "Resources", gloss: "data it exposes",
      items: dedupe(snapshot.resources.map((r) => ({ kind: "resource" as const, id: r.uri, label: r.name, blurb: firstLine(r.description) ?? r.uri }))) },
    { kind: "prompt", label: "Prompts", gloss: "ready-made instructions",
      items: dedupe(snapshot.prompts.map((p) => ({ kind: "prompt" as const, id: p.name, label: p.name, blurb: firstLine(p.description) }))) },
  ]
  return { tools, rail, emphasis: tools.length <= 4 ? "tool-light" : "regular" }
}
```

- [ ] **Step 4: Run to verify pass** — `npm test -- deckModel`
- [ ] **Step 5: Commit** — `git add src/ui/deck/deckModel.ts src/ui/deck/deckModel.test.ts && git commit -m "feat: deck model — run-class eligibility, rail grouping, dedupe, adaptive emphasis"`

### Task 4: Arm machine (TDD)

**Files:**
- Create: `src/ui/deck/armState.ts`
- Test: `src/ui/deck/armState.test.ts`

**Interfaces:**
- Produces (used by Task 7):

```ts
export const ARM_TIMEOUT_MS = 4000
export interface ArmResult { armedId: string | null; fire: string | null }
export function pressTool(armedId: string | null, id: string, runClass: RunClass): ArmResult
```

Pure transition function; the timer/listeners live in the DeckView hook (Task 7). Rules (spec §4): `instant` ⇒ fire immediately, disarm anything; `arm` first press ⇒ armed (exactly one), press-while-armed-same ⇒ fire + disarm, press-other ⇒ re-arm other; `input-required` ⇒ never fires, disarms.

- [ ] **Step 1: Failing tests:**

```ts
import { pressTool } from "./armState"

test("instant fires immediately and never arms", () => {
  expect(pressTool(null, "a", "instant")).toEqual({ armedId: null, fire: "a" })
  expect(pressTool("b", "a", "instant")).toEqual({ armedId: null, fire: "a" })
})

test("arm-class: first press arms, second fires, other tool re-arms", () => {
  expect(pressTool(null, "a", "arm")).toEqual({ armedId: "a", fire: null })
  expect(pressTool("a", "a", "arm")).toEqual({ armedId: null, fire: "a" })
  expect(pressTool("a", "b", "arm")).toEqual({ armedId: "b", fire: null })
})

test("input-required never fires and disarms", () => {
  expect(pressTool("a", "c", "input-required")).toEqual({ armedId: null, fire: null })
})
```

- [ ] **Step 2: Verify fail** → **Step 3: Implement** (direct transcription of the table) → **Step 4: Verify pass**
- [ ] **Step 5: Commit** — `git commit -m "feat: arm-then-fire state machine"`

### Task 5: Run result formatting (TDD)

**Files:**
- Create: `src/ui/run/runResult.ts`
- Test: `src/ui/run/runResult.test.ts`

**Interfaces:**
- Produces (used by Tasks 6, 8):

```ts
export const MAX_RESULT_CHARS = 50_000
export interface RunDisplay { ok: boolean; blocks: { label?: string; text: string }[]; truncated: boolean }
export function formatCallResult(result: unknown): RunDisplay
export function formatRunError(error: unknown): RunDisplay
```

Rules (spec §5 + security): input is untrusted `unknown`. Narrow defensively: `content` array items with `type === "text"` and string `text` render as text (JSON-parseable text pretty-prints via `JSON.stringify(JSON.parse(t), null, 2)`); non-text items render a labeled placeholder line (`"(image content — not rendered)"` etc.); `structuredContent` (object) pretty-prints as one block labeled `structured`. `isError === true` ⇒ `ok: false`. Total across blocks capped at `MAX_RESULT_CHARS` (per-block slice, set `truncated`). No HTML ever — the consumer renders `<pre>{text}</pre>` (React escapes).

- [ ] **Step 1: Failing tests** covering: text block passthrough; JSON pretty-print; `isError` flag; non-text placeholder (`{ type: "image", data: "...", mimeType: "image/png" }`); malformed result (`null`, `{ content: "nope" }`) yields honest `ok:false` "unrecognised result shape" block rather than a throw; cap: a 60k-char text block truncates to `MAX_RESULT_CHARS` with `truncated: true`; `formatRunError(new Error("boom"))` → `{ ok: false, blocks: [{ text: "boom" }], truncated: false }`.
- [ ] **Step 2: Verify fail** → **Step 3: Implement** → **Step 4: Verify pass**
- [ ] **Step 5: Commit** — `git commit -m "feat: sanitized run-result formatting with defensive caps"`

### Task 6: Demo server curation (TDD)

**Files:**
- Modify: `src/mcp/demo/demoServer.ts`
- Modify: `src/mcp/demo/demoServer.test.ts` (counts/assertions)
- Modify: `src/App.test.tsx` (`TOOLS · 4` → new count, if this lands before Task 7 keep in sync with whatever renders it)

**Interfaces:**
- Produces: demo server whose every tool is zero-required (spec §5 "all demo-server tools" are eligible — required fields become optional with handler defaults), with `annotations` distributing the three §4 button classes across the demo, plus two curated showcase tools.

Changes:
1. `create_issue`: `title` → `z.string().optional().describe("Issue title")`, handler defaults `title ?? "Untitled issue"`. No annotations ⇒ **arm** class.
2. `list_issues`, `search_issues`: add `annotations: { readOnlyHint: true }` ⇒ **instant** class. `search_issues` handler returns two matching canned issues (a satisfying non-empty result), `query` optional (default `""` lists all).
3. `close_issue`: `id` optional (default `104`) — **arm** class.
4. New showcase tool `project_pulse` (**instant** — the one-click portfolio moment): `annotations: { readOnlyHint: true }`, no inputs, returns pretty JSON: open/closed counts, `velocity: [3,5,4,7,6,9,8]`, a unicode sparkline `"▂▄▃▆▅█▇"`, and a `recentActivity` feed of 4 canned events. Deterministic (canned timestamps).
5. New showcase tool `generate_release_notes` (**arm** — the arm-then-fire moment): no required inputs (`tone` enum optional), returns multi-section markdown release notes for "v1.4.0" from the canned issues.

Demo tool count becomes **6**. Registration code follows the existing `registerTool` idiom in the file exactly.

- [ ] **Step 1: Extend `demoServer.test.ts` first** — assert new tool count, `project_pulse` result parses as JSON and contains `velocity`, `generate_release_notes` returns markdown containing `# v1.4.0`, and *every* demo tool's listed schema has no required fields (guard for spec §5):

```ts
const { tools } = await client.listTools()
expect(tools).toHaveLength(6)
for (const t of tools) expect((t.inputSchema.required ?? []) as string[]).toEqual([])
```

- [ ] **Step 2: Verify fail** → **Step 3: Implement** → **Step 4: Verify pass** (update `App.test.tsx` count assertions in the same change: 5 occurrences of `TOOLS · 4`).
- [ ] **Step 5: Commit** — `git commit -m "feat: demo curation — zero-required schemas, readOnlyHint annotations, project_pulse + release-notes showcase tools"`

### Task 7: Run context (TDD)

**Files:**
- Create: `src/ui/run/RunContext.tsx`
- Test: `src/ui/run/RunContext.test.tsx`

**Interfaces:**
- Consumes: `Connection` (`client.callTool`), `formatCallResult`/`formatRunError` (Task 5).
- Produces (used by Tasks 8–9):

```ts
export type RunState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "done"; display: RunDisplay }
export function RunProvider({ connection, children }: { connection: Connection; children: ReactNode }): JSX.Element
export function useRuns(): { runs: Record<string, RunState>; run: (toolName: string) => void }
```

`run(name)`: set `running`, `await connection.client.callTool({ name, arguments: {} })` → `done` with `formatCallResult`; catch → `done` with `formatRunError`. Ignore a re-run request while that tool is already `running`. State keyed per tool name; a stale resolution after disconnect is harmless (provider unmounts with connection).

- [ ] **Step 1: Failing test** — RTL with a real `connectDemo()` connection: a probe component calls `run("project_pulse")`; assert transition idle→running→done ok, and that an unknown tool name lands `done` with `ok: false` (SDK error path). 
- [ ] **Step 2: Verify fail** → **Step 3: Implement** → **Step 4: Verify pass**
- [ ] **Step 5: Commit** — `git commit -m "feat: run context — per-tool run state over client.callTool"`

### Task 8: The deck stage — DeckView, ToolButton, Rail, Prism; flow view retired

**Files:**
- Create: `src/ui/deck/DeckView.tsx`, `src/ui/deck/DeckView.module.css`
- Create: `src/ui/deck/ToolButton.tsx`, `src/ui/deck/ToolButton.module.css`
- Create: `src/ui/deck/Rail.tsx` (uses DeckView.module.css)
- Create: `src/ui/deck/Glyph.tsx` (ported from FlowView's `Glyph`, all three shapes)
- Create: `src/ui/deck/Prism.tsx`
- Test: `src/ui/deck/DeckView.test.tsx`
- Modify: `src/App.tsx`, `src/App.module.css`
- Delete: `src/ui/flow/` (FlowView.tsx, FlowView.module.css, FlowView.test.tsx, TraceLayer.tsx, flowModel.ts, flowModel.test.ts)
- Modify: `src/global.css` (delete `--edge`, `--node-core`, `--node-ring` — allowlisted, so the dune test is unaffected)

**Interfaces:**
- Consumes: `StageProps` (unchanged contract), `buildDeckModel`, `pressTool`/`ARM_TIMEOUT_MS`, `useRuns`.
- Produces: `DeckView` as the default stage; `TOOLS_PREVIEW_MAX = 24`, `RAIL_PREVIEW_MAX = 10` exported from `DeckView.tsx`; accessible names — main button `tool {name}` at rest / `Run {name}` armed (`aria-pressed` reflects armed), info button `details {name}`, rail entries `{kind} {name}`, tooltip `role="tooltip"` + `aria-describedby`.

Structure:

```tsx
<section className={styles.boundary} data-emphasis={model.emphasis} aria-label={`Server ${snapshot.serverInfo.name}`}>
  <header className={styles.deckHeader}>
    <Prism className={styles.emblem} />
    <span className={styles.serverName}>{snapshot.serverInfo.name}</span>
    <span className={styles.chip}>v{snapshot.serverInfo.version}</span>
    <span className={styles.chip}>{transportKind}</span>
    <input aria-label="Filter items" ... />  {/* toolbar filter, right-aligned */}
  </header>
  <div className={styles.body}>
    <div className={styles.grid} role="group" aria-label="Tools">
      <header>TOOLS · {n}</header> <p className={styles.gloss}>actions it can perform</p>
      {visibleTools.map((t) => <ToolButton .../>)}
      {capped && <button className={styles.more}>+ N more</button>}
    </div>
    <Rail groups={model.rail} ... />
  </div>
</section>
```

Behaviour to carry over from FlowView: filter recede (`data-receded`, bypasses caps when active), per-section preview caps with `+ N more` / `− show fewer`, canonical headers + glosses, empty-kind `none` line. Selection ring on the selected tool/rail entry (`aria-pressed` on rail entries as today's pills).

`useArm` hook inside `DeckView.tsx`:

```tsx
function useArm(onFire: (id: string) => void) {
  const [armedId, setArmedId] = useState<string | null>(null)
  const press = (id: string, runClass: RunClass) => {
    const next = pressTool(armedId, id, runClass)
    setArmedId(next.armedId)
    if (next.fire) onFire(next.fire)
  }
  const disarm = () => setArmedId(null)
  useEffect(() => {
    if (armedId === null) return
    const t = setTimeout(disarm, ARM_TIMEOUT_MS)
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && disarm()
    window.addEventListener("keydown", onKey)
    window.addEventListener("scroll", disarm, { capture: true, passive: true })
    window.addEventListener("pointerdown", disarm) // ToolButton stops propagation on its own presses
    return () => { clearTimeout(t); window.removeEventListener("keydown", onKey); window.removeEventListener("scroll", disarm, { capture: true }); window.removeEventListener("pointerdown", disarm) }
  }, [armedId])
  return { armedId, press, disarm }
}
```

Fire handler: `run(id); onSelect({ kind: "tool", id })` — result lands in the panel (spec §5). Info icon and input-required click: `onSelect(...)` only, and disarm. Selection change (panel open) disarms via effect on `selection`.

`ToolButton` (no nested interactive elements — card wraps two sibling buttons + tooltip):

```tsx
<div className={styles.card} data-armed={armed || undefined} data-running={running || undefined} data-class={tool.runClass}>
  <button type="button" className={styles.face}
    aria-label={armed ? `Run ${tool.label}` : `tool ${tool.label}`}
    aria-pressed={tool.runClass === "arm" ? armed : undefined}
    aria-describedby={tool.blurb ? tipId : undefined}
    onPointerDown={(e) => e.stopPropagation()}
    onClick={onPress}>
    <Glyph kind="tool" />
    <span className={styles.name}>{armed ? <>Run {tool.label} ▸</> : tool.label}</span>
    {tool.runClass === "input-required" && <span className={styles.needsInput}>needs input</span>}
  </button>
  <button type="button" className={styles.info} aria-label={`details ${tool.label}`} onPointerDown={(e) => e.stopPropagation()} onClick={onInfo}>i</button>
  {tool.blurb && <div role="tooltip" id={tipId} className={styles.tip}>{tool.blurb}</div>}
</div>
```

Tooltip: CSS-anchored above the card (`position: absolute; bottom: calc(100% + 6px)`), visible on `.card:hover`/`.card:focus-within`, 150ms fade, never cursor-chasing. Keyboard: native button semantics give Enter/Space = press (arm/fire); Esc handled by `useArm`.

CSS (starting point — Task 11 iterates from screenshots; all colours via tokens/`color-mix`): boundary = hairline `--panel-border` border + `--panel` frost + `backdrop-filter: blur(14px)`; grid = `repeat(auto-fill, minmax(180px, 1fr))`; button face = near-white sheet, hover ⇒ faint edge light (`box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tool) 35%, transparent)`), focus-visible ⇒ full edge ignition (2px `--tool` ring + soft outer `color-mix` halo), armed ⇒ sustained lit edge + tinted fill (`color-mix(in srgb, var(--tool) 8%, transparent)`), press ⇒ `transform: scale(0.98)` (light compresses); `[data-running]` ⇒ circulating edge (conic-gradient border animation; reduced-motion ⇒ static lit edge); `[data-class="input-required"]` ⇒ no run affordance — flat fill, dashed hairline, `needs input` tag in `--ink-3`. `[data-emphasis="tool-light"]` ⇒ grid doesn't stretch (`max-width` clamp), rail widens.

`Prism.tsx` — hairline SVG, geometry only (three variants for Task 11; variant A default):

```tsx
export default function Prism({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 32" aria-hidden="true" fill="none">
      <path d="M2 16 H20" stroke="var(--ink)" strokeWidth="1.5" />
      <path d="M20 16 L46 6" stroke="var(--tool)" strokeWidth="1.5" />
      <path d="M20 16 H46" stroke="var(--resource)" strokeWidth="1.5" />
      <path d="M20 16 L46 26" stroke="var(--prompt)" strokeWidth="1.5" />
      <path d="M20 8 L28 16 L20 24 Z" stroke="var(--ink)" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}
```

`App.tsx`: replace `FlowView` import with `DeckView`; wrap the connected view in `<RunProvider connection={phase.connection}>`; slim the app header to brand (small `Prism` + `MCP EXPLORE`) + Disconnect — server name/version/transport now live in the deck boundary (multi-server seam). `App.module.css` restyled to match (hairline header on `--header-bg`).

- [ ] **Step 1: Failing RTL suite** `DeckView.test.tsx` — helpers:

```tsx
const renderDeck = async (transportKind: TransportKind = "in-memory", snapshot?: ServerSnapshot) => {
  const conn = await connectDemo()
  const props = { snapshot: snapshot ?? conn.snapshot, transportKind, selection: null, onSelect: vi.fn() }
  render(<RunProvider connection={conn}><DeckView {...props} /></RunProvider>)
  return { conn, props }
}
```

Cases (the §4 table, each row): instant (`project_pulse`) single click fires (spy `conn.client.callTool`) and selects; arm (`create_issue`) first click arms (aria-pressed, `Run create_issue` name) without calling, second fires exactly once; Esc disarms; clicking another tool re-arms it (only one armed); 4s timeout disarms (fake timers + `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })`); info button selects without ever calling; input-required (fake `streamable-http` snapshot with a required-arg tool) click selects, never calls, face shows `needs input`; filter recedes non-matches and bypasses the cap (fake snapshot with `TOOLS_PREVIEW_MAX + 2` tools: capped at rest, `+ 2 more` present, all visible while filtering); rail renders canonical headers/glosses and entries select; keyboard: tab to face → Enter arms → Enter fires.

- [ ] **Step 2: Verify fail** → **Step 3: Implement all files above** → **Step 4: Full suite** — `npm test` (App.test.tsx: update the panel-flow test to the deck's names — `tool create_issue` label is kept, `TOOLS · 6` from Task 6 still renders in the grid header).
- [ ] **Step 5: Delete `src/ui/flow/` + the three graph-mark tokens**; `npm test` again; `npm run build` for dead-import typechecking.
- [ ] **Step 6: Commit**

```bash
git add -A src/ui/deck src/ui/run src/App.tsx src/App.module.css src/global.css src/App.test.tsx
git rm -r src/ui/flow
git commit -m "feat: control-deck stage — tool grid with arm/fire run loop, rail, prism emblem; retire flow view"
```

### Task 9: Detail panel — run results, honest states, spring slide

**Files:**
- Modify: `src/ui/DetailPanel.tsx`, `src/ui/DetailPanel.module.css`, `src/ui/DetailPanel.test.tsx`
- Modify: `src/App.tsx` (wrap panel in `AnimatePresence`)

**Interfaces:**
- Consumes: `useRuns` (panel must render inside `RunProvider` — it already renders next to the stage in App), `RunDisplay`.

Changes:
1. `ToolView` gains a **RUN** section above ARGUMENTS: `running` ⇒ in-flight line ("Running…", `aria-live="polite"`); `done && ok` ⇒ result blocks as `<pre className={styles.code}>{block.text}</pre>` landing with a settle (motion fade/6px rise); `done && !ok` ⇒ distinct honest error treatment (`--danger` hairline + plain message, no success motion). Truncated ⇒ "output capped at 50,000 characters" line in `--ink-3`.
2. Input-required tools: honest state under ARGUMENTS — *"inputs required — running these is coming"* (spec §4; classification via `classifyTool(tool, connection.transportKind)`).
3. Panel becomes `motion.aside`: spring slide (`initial={{ x: "110%" }} animate={{ x: 0 }} exit={{ x: "110%" }} transition={{ type: "spring", stiffness: 320, damping: 32 }}`), interruptible reverse via `<AnimatePresence>` in App; content staggers in at ~20ms/element (parent `variants` + `staggerChildren: 0.02`). Reduced motion handled by `MotionConfig` (Task 10).
4. Restyle CSS module to the light identity (frosted `--panel-solid` sheet, hairline, ink tokens).

- [ ] **Step 1: Failing tests** — run section renders result text for a `done` run; error run shows the error treatment (role="alert"); input-required tool shows the honest line; existing assertions updated to the new structure. Panel-exit tests use `waitForElementToBeRemoved` (AnimatePresence defers unmount).
- [ ] **Step 2: Verify fail** → **Step 3: Implement** → **Step 4: `npm test`**
- [ ] **Step 5: Commit** — `git commit -m "feat: detail panel — run results with honest error state, spring slide, light restyle"`

### Task 10: Choreography — power-on, layout animation, reduced-motion floors

**Files:**
- Modify: `src/ui/deck/DeckView.tsx`, `src/ui/deck/DeckView.module.css`, `src/ui/deck/ToolButton.tsx`
- Modify: `src/main.tsx` (wrap `<App />` in `<MotionConfig reducedMotion="user">`)

Changes:
1. **Deck power-on** (the centrepiece, one-shot, ≤1.5s, deterministic): boundary hairline draws in (motion on a border-reveal pseudo-strategy: boundary `initial={{ opacity: 0, scale: 0.985 }}` + a `clip-path: inset()` sweep 350ms), then grid buttons ignite in a staggered cascade (`staggerChildren: 0.02`, each `initial={{ opacity: 0, y: 6 }}` with a brief edge-light flash via CSS animation class), rail follows (`delayChildren` after grid), settle to stillness. Keyed on `snapshot.serverInfo.name` so it runs once per connect.
2. **Arm sweep**: armed fill becomes a ~150ms luminous sweep (motion `layout`-free — CSS `background-position` transition on a `color-mix` gradient) that holds; disarm drains it back (reverse transition).
3. **Expand/collapse & filter**: `+ N more` reveal animates layout (`motion.div layout` on the grid/rail lists; new items fade in).
4. **Reduced motion**: `MotionConfig reducedMotion="user"` + existing CSS floor kills every entrance/loop; verify nothing is functionally lost.
5. Nothing loops at rest — audit: the only persistent animation allowed is `[data-running]` edge circulation *while a call is in flight*.

- [ ] **Step 1: Implement** (visual work; no new unit tests — Tier-2 keeps passing, add one RTL guard: with `matchMedia` unavailable-safe check the deck still renders synchronously — power-on must not gate first paint of content for tests/reduced-motion).
- [ ] **Step 2: `npm test` + `npm run build`**
- [ ] **Step 3: Commit** — `git commit -m "feat: deck power-on cascade, arm sweep, layout animation; reduced-motion floors"`

### Task 11: Landing — two doors + ConnectError restyle

**Files:**
- Modify: `src/ui/ConnectScreen.tsx`, `src/ui/ConnectScreen.module.css`, `src/ui/ConnectScreen.test.tsx`
- Modify: `src/ui/ConnectError.module.css` (restyle only — `ConnectError.tsx` behaviour unchanged)

Changes (spec §7 — behaviour of connect/headers/remember/recents/diagnostics unchanged, structure and skin new):
1. Hero: kicker + `Space Grotesk` headline + sub + newcomer gloss stay; one ambient motion only — a slow (≥20s) drift on the canvas tints via a single CSS animation on the hero backdrop, killed by reduced motion. No graph preview.
2. **Two equal doors** (CSS grid, side-by-side ≥720px, stacked below): Door 1 "Connect your server" — URL form, headers disclosure, remember, recents (all existing JSX moves inside). Door 2 "Explore a live demo" — *no setup, runs in your tab* copy, prism motif, styled as the more inviting door (`--cta-gradient` wash + lit hairline); button copy becomes **"Explore the demo"**.
3. Error panel renders below the doors, full width; `ConnectError.module.css` re-skinned to light (hairline card, `--danger` accents, `--code-bg` blocks).
4. Update tests: accessible name `/explore the demo/i` replaces `/try the demo/i` (also in `App.test.tsx` — 3 occurrences).

- [ ] **Step 1: Update tests first** (copy changes) → **Step 2: Implement** → **Step 3: `npm test`**
- [ ] **Step 4: Commit** — `git commit -m "feat: two-door landing — connect + demo doors, ambient drift, light diagnostics restyle"`

### Task 12: Visual iteration checkpoint (screenshots ⇒ user)

> **Status 2026-08-26**: comparison sets captured and presented (session scratchpad: `shots-inter-a/`, `shots-geist/`, `shots-prism-b/`, `shots-prism-c/`, `shots-grain/`). The picks — UI face (Inter vs Geist), prism variant (A/B/C), grain keep/drop — are **deliberately pending the user's reveal review**, not dropped: `@fontsource-variable/geist` stays installed until the face is chosen (the loser is uninstalled then), and the favicon follows the prism choice. Working defaults meanwhile: Inter, prism A, no grain.

The spec resolves these **only from rendered pixels**: UI face (Inter vs Geist), prism variant (draw 2–3), grain-on-light keep/drop, adaptive-emphasis behaviour, choreography timings, palette feel. Iterate autonomously to a presentable state, then present screenshot sets to the user in prose (never AskUserQuestion — user preference).

- [ ] **Step 1**: Restart `npm run dev` (WSL staleness rule). Screenshot: landing, demo deck (power-on settled), armed button, running button, result in panel, filtered deck, cloudflare-shaped tool-light snapshot, HF-shaped 155-resource rail (fake snapshots acceptable for the shape shots via a dev-only `?server=` demo variant or Playwright-driven real servers).
- [ ] **Step 2**: Font bake-off — flip `--ui` + `main.tsx` import to `@fontsource-variable/geist`, re-screenshot same views, present both sets; after the user picks, `npm uninstall` the loser and fix the import.
- [ ] **Step 3**: Prism variants — 2–3 `Prism` geometries screenshotted on the landing door + deck header; user picks; chosen one becomes the favicon: `index.html` gains `<link rel="icon" href="data:image/svg+xml,...">` (URL-encoded inline SVG of the chosen mark; touch nothing else in `index.html` — the dune script tag stays).
- [ ] **Step 4**: Grain trial — one screenshot pair with/without a low-opacity paper-grain overlay (SVG turbulence data-URI at ~2–3% opacity on `body::after`); user judges keep/drop.
- [ ] **Step 5**: Apply the user's calls, commit — `git commit -m "feat: visual resolution — UI face, prism mark + favicon, grain decision, emphasis tuning"`

### Task 13: Live QA sweep + fix wave

- [ ] **Step 1**: Re-verify public servers with curl before relying (they churn): `https://mcp.deepwiki.com/mcp`, `https://docs.mcp.cloudflare.com/mcp`, `https://huggingface.co/mcp` (`curl -s -X POST -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"qa","version":"0"}}}'` each).
- [ ] **Step 2**: Browser QA per spec §9: demo (primary showcase — full run loop both classes); deepwiki (annotation-less remote tools → arm or input-required per schema); cloudflare (tool-light emphasis); HF (rail preview-cap at 155 resources, filter across kinds); `https://mcpplaygroundonline.com/mcp-complex-server` (diagnostic panel renders in the new skin, ISSUE-1 known-bad).
- [ ] **Step 3**: Keyboard + reduced-motion pass (OS-level or DevTools emulation): full run loop by keyboard alone; reduced motion swaps every entrance to instant.
- [ ] **Step 4**: Fix wave for anything found; `npm test` + `npm run build`; commit — `git commit -m "fix: live-QA fix wave"`

### Task 14: Docs sync + finish

- [ ] **Step 1**: `docs/functional-description.md` — deck behaviour (boundary, grid, rail, run loop with the §4 click-semantics table, tooltips, filter/caps), landing doors, panel run results.
- [ ] **Step 2**: `docs/architecture-overview.md` — deck as default stage, `src/ui/deck/` + `src/ui/run/` structure, retired `src/ui/flow/`, `motion` + font dependencies, RunContext topology.
- [ ] **Step 3**: `TODO.md` — move TODO-15 to Completed (executed by this spec); TODO-1/5/16/18 already carry their 2026-08-26 notes (committed in Task 1); add a note to TODO-12 for any items this work absorbed (dedupe) or newly deferred (Esc-closes-panel, focus restore).
- [ ] **Step 4**: Amend the redesign spec's §Palette with one line pointing at this plan's validated table. No `DEPLOYMENTS.md` entry until the user approves the eventual push to main (one reveal).
- [ ] **Step 5**: `npm test`, `npm run build`, then REQUIRED SUB-SKILL superpowers:requesting-code-review against the spec; fix findings; final commit. Present the branch + screenshots to the user for the reveal review. **Do not push.**

## Self-review notes

- Spec coverage: §2 identity → T2/T12; §Palette record → this plan; §3 IA (boundary/grid/rail/emphasis/filter/caps/tooltip) → T3/T8; §4 click table + arm machine + a11y → T3/T4/T8; §5 eligibility/results/choreography/demo curation → T3/T5/T6/T7/T9; §6 five choreography moments → T9 (panel), T10 (power-on, arm sweep, layout), T11 (landing entrance); §7 doors → T11; §8 floors → T2 (AA values), T8 (keyboard/aria), T10 (reduced motion), T13 (audit); §9 verification → per-task tests + T13; §10 order/one-reveal/docs → task order, T1, T14.
- Type consistency: `RunClass` defined once in `deckModel.ts`, imported by `armState.ts`/`ToolButton`; `RunDisplay` defined in `runResult.ts`, imported by `RunContext`/`DetailPanel`; `pressTool` signature identical in T4 and T8's hook.
- Known intentional deviations from spec letter: branch base (see Global Constraints); demo tools made zero-required so "all demo-server tools eligible" cannot produce validation-error runs.
