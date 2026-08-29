# Tool-first workspace — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the deck's grid + rail + drawer with a permanent browsing column and workspace, make one click run a tool, and generate input forms from tool schemas.

**Architecture:** `App` renders one chrome band and owns the filter query; `DeckView` becomes a two-region stage — `BrowseColumn` (segmented Tools/Resources/Prompts list, left) and `Workspace` (one subject at a time, right). Selection is the existing `EntitySelection | null`, where `null` means home. Pure argument logic lives in `src/ui/form/argValues.ts` so it is unit-testable without rendering.

**Tech Stack:** React 19, TypeScript, CSS Modules, motion/react, Vitest + RTL.

**Spec:** [`docs/specs/2026-08-29-tool-first-workspace.md`](../specs/2026-08-29-tool-first-workspace.md)

## Global Constraints

- Everything from a server is untrusted: no `dangerouslySetInnerHTML`, no eval, model server data as `unknown` and narrow. Text nodes only.
- No new dependencies.
- All colours via CSS custom properties; no hardcoded colour values.
- `src/dune/` is another session's territory — do not edit. `--code-bg` stays on the dune parity allowlist and keeps its current value.
- Tier 1 (`npm test`) must stay green after every task; `npm run build` typechecks.
- Commit after each task. Do not push.

---

## File Structure

**Create**
- `src/ui/ChromeBar.tsx` / `.module.css` — the single chrome band: brand, server identity, filter, mode toggle, disconnect.
- `src/ui/deck/BrowseColumn.tsx` / `.module.css` — home control, segmented control, the three lists, resource tree.
- `src/ui/deck/Workspace.tsx` / `.module.css` — subject router + shared workspace chrome.
- `src/ui/deck/HomeView.tsx` — server identity + `instructions`.
- `src/ui/deck/ToolView.tsx` — description, form, run control, result.
- `src/ui/deck/ResourceView.tsx` — metadata + contents.
- `src/ui/deck/PromptView.tsx` — description, argument form, messages.
- `src/ui/form/ArgsForm.tsx` / `.module.css` — schema-driven fields.
- `src/ui/form/argValues.ts` / `argValues.test.ts` — pure: schema → field specs, validation, argument assembly.

**Modify**
- `src/App.tsx` / `src/App.module.css` — chrome band, filter state.
- `src/ui/stage.ts` — `StageProps` gains `query: string`.
- `src/ui/deck/DeckView.tsx` / `.module.css` — two-region layout.
- `src/ui/deck/deckModel.ts` — `RunClass` collapses; emphasis removed.
- `src/ui/run/RunContext.tsx` — `run(name, args)`.
- `src/ui/run/ReadContext.tsx` — `read(kind, id, args?)`.
- `src/global.css` — variant E palette.

**Delete**
- `src/ui/deck/ToolDrawer.tsx` / `.module.css` / `.test.tsx`
- `src/ui/deck/armState.ts` / `.test.ts`
- `src/ui/deck/ToolButton.tsx` / `.module.css`
- `src/ui/deck/Rail.tsx`

---

### Task 1: Palette — variant E

**Files:**
- Modify: `src/global.css:2-8` (light `:root`), dark block

**Interfaces:**
- Produces: tokens `--bg`, `--glow-a`, `--glow-b`, `--header-bg`, `--ink-3` at variant-E values.

- [ ] **Step 1:** In the light `:root`, set `--bg: #eaf0f8`, `--glow-a: rgba(8,145,178,.2)`, `--glow-b: rgba(109,40,217,.12)`, `--header-bg: rgba(238,244,251,.72)`, `--ink-3: #5a6070`.
- [ ] **Step 2:** Update `body`'s `background-image` geometry to `radial-gradient(1050px 820px at 10% -14%, var(--glow-a), transparent 64%)` and `radial-gradient(1100px 880px at 94% 114%, var(--glow-b), transparent 62%)`.
- [ ] **Step 3:** Run `npm test` — the dune parity test reads the first `:root` block; confirm it still passes (only values changed, no token added or removed).
- [ ] **Step 4:** Commit: `feat: variant-E canvas — stronger luminous gradient, darkened ink-3`

---

### Task 2: Pure argument logic

**Files:**
- Create: `src/ui/form/argValues.ts`, `src/ui/form/argValues.test.ts`

**Interfaces:**
- Produces:
  - `type FieldKind = "text" | "number" | "boolean" | "enum" | "stringList" | "json"`
  - `interface FieldSpec { name: string; kind: FieldKind; required: boolean; description?: string; enumValues?: string[]; rawType: string; initial: string }`
  - `fieldSpecs(schema: unknown): FieldSpec[]`
  - `type Values = Record<string, string>`
  - `initialValues(specs: FieldSpec[]): Values`
  - `interface Assembly { args: Record<string, unknown>; errors: Record<string, string>; missing: string[] }`
  - `assembleArgs(specs: FieldSpec[], values: Values): Assembly`

- [ ] **Step 1: Write the failing tests**

```ts
import { assembleArgs, fieldSpecs, initialValues } from "./argValues"

const schema = {
  type: "object",
  properties: {
    title: { type: "string", description: "Issue title" },
    limit: { type: "integer", default: 20 },
    urgent: { type: "boolean" },
    status: { type: "string", enum: ["open", "closed"] },
    labels: { type: "array", items: { type: "string" } },
    nested: { type: "object", properties: { a: { type: "string" } } },
  },
  required: ["title"],
}

test("maps schema properties to field kinds", () => {
  expect(fieldSpecs(schema).map((f) => [f.name, f.kind])).toEqual([
    ["title", "text"], ["limit", "number"], ["urgent", "boolean"],
    ["status", "enum"], ["labels", "stringList"], ["nested", "json"],
  ])
})

test("required flags come from the schema", () => {
  expect(fieldSpecs(schema).find((f) => f.name === "title")?.required).toBe(true)
  expect(fieldSpecs(schema).find((f) => f.name === "limit")?.required).toBe(false)
})

test("defaults prefill", () => {
  expect(initialValues(fieldSpecs(schema)).limit).toBe("20")
})

test("untrusted shapes never throw", () => {
  for (const bad of [null, 42, "x", {}, { properties: 7 }, { properties: { a: null } }]) {
    expect(() => fieldSpecs(bad)).not.toThrow()
  }
})

test("empty optionals are omitted, not sent as empty strings", () => {
  const specs = fieldSpecs(schema)
  const { args } = assembleArgs(specs, { ...initialValues(specs), title: "hi", limit: "" })
  expect(args).toEqual({ title: "hi" })
})

test("numbers are coerced, bad numbers reported", () => {
  const specs = fieldSpecs(schema)
  expect(assembleArgs(specs, { title: "t", limit: "5" }).args.limit).toBe(5)
  expect(assembleArgs(specs, { title: "t", limit: "abc" }).errors.limit).toMatch(/number/i)
})

test("booleans, enums and string lists convert", () => {
  const specs = fieldSpecs(schema)
  const { args } = assembleArgs(specs, { title: "t", urgent: "true", status: "open", labels: "a, b ,c" })
  expect(args).toMatchObject({ urgent: true, status: "open", labels: ["a", "b", "c"] })
})

test("json fields parse, and report their own syntax errors", () => {
  const specs = fieldSpecs(schema)
  expect(assembleArgs(specs, { title: "t", nested: '{"a":"b"}' }).args.nested).toEqual({ a: "b" })
  expect(assembleArgs(specs, { title: "t", nested: "{oops" }).errors.nested).toMatch(/JSON/i)
})

test("missing required fields are listed", () => {
  const specs = fieldSpecs(schema)
  expect(assembleArgs(specs, { title: "" }).missing).toEqual(["title"])
})
```

- [ ] **Step 2:** Run `npx vitest run src/ui/form/argValues.test.ts` — expect failure, module not found.
- [ ] **Step 3:** Implement `argValues.ts`. Build on `schemaRows` from `src/ui/schema.ts` for narrowing; map `enum` → `enum`, `string[]` → `stringList`, `number`/`integer` → `number`, `boolean` → `boolean`, `string` → `text`, everything else → `json`. `initial` is `JSON.stringify(default)` for json fields, the raw string form otherwise, `""` when absent. `assembleArgs` skips empty non-required values, coerces per kind, and collects per-field errors plus a `missing` list.
- [ ] **Step 4:** Run the test file — expect PASS.
- [ ] **Step 5:** Commit: `feat: schema-driven argument values — field specs, coercion, assembly`

---

### Task 3: Contexts accept arguments

**Files:**
- Modify: `src/ui/run/RunContext.tsx`, `src/ui/run/ReadContext.tsx`
- Test: `src/ui/run/RunContext.test.tsx` (create)

**Interfaces:**
- Produces: `run(toolName: string, args?: Record<string, unknown>): void`; `read(kind: ReadKind, id: string, args?: Record<string, string>): void`.

- [ ] **Step 1:** Write a test asserting `run("t", { a: 1 })` passes `{ name: "t", arguments: { a: 1 } }` to a stub client, and that a second call while in flight is ignored.
- [ ] **Step 2:** Run it — expect failure.
- [ ] **Step 3:** Add the `args` parameter to both contexts (`arguments: args ?? {}`; `getPrompt({ name: id, arguments: args })`). Keep the in-flight ref guard.
- [ ] **Step 4:** Run `npm test` — expect PASS.
- [ ] **Step 5:** Commit: `feat: run and read contexts take arguments`

---

### Task 4: Chrome band

**Files:**
- Create: `src/ui/ChromeBar.tsx`, `src/ui/ChromeBar.module.css`
- Modify: `src/App.tsx`, `src/App.module.css`, `src/ui/stage.ts`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `ChromeBar` props `{ snapshot, transportKind, query, onQuery, onDisconnect }`; `StageProps` gains `query: string`.

- [ ] **Step 1:** Update `src/App.test.tsx` to assert one banner containing the brand, the server name, the version and transport chips, the filter input and Disconnect — and that the old boundary header no longer renders a second prism.
- [ ] **Step 2:** Run — expect failure.
- [ ] **Step 3:** Build `ChromeBar` (58px, `--header-bg`, hairline bottom, brand + divider + identity left, filter/mode/disconnect right). `App` owns `query` state and passes `query` into the stage. Remove the header markup from `DeckView`.
- [ ] **Step 4:** Run `npm test`.
- [ ] **Step 5:** Commit: `feat: one chrome band — app header and server identity merged`

---

### Task 5: Two-region layout, browse column, home

**Files:**
- Create: `src/ui/deck/BrowseColumn.tsx` / `.module.css`, `src/ui/deck/Workspace.tsx` / `.module.css`, `src/ui/deck/HomeView.tsx`
- Modify: `src/ui/deck/DeckView.tsx` / `.module.css`, `src/ui/deck/deckModel.ts`
- Test: `src/ui/deck/DeckView.test.tsx`

**Interfaces:**
- Consumes: `StageProps.query` (Task 4).
- Produces: `BrowseColumn` props `{ model, query, selection, onSelect }`; `Workspace` props `{ snapshot, transportKind, selection, onSelect }`; selection `null` = home.

- [ ] **Step 1:** Write tests: the column shows a Home control and a segmented control with per-kind counts; switching segment swaps the list; the workspace renders the server's `instructions` at first paint; selecting a tool replaces home; Home returns to instructions.
- [ ] **Step 2:** Run — expect failure.
- [ ] **Step 3:** Implement. `deckModel` drops `emphasis` and `TOOL_LIGHT_MAX`; `RunClass` collapses to `"runnable" | "input-required"` where `input-required` means "has required arguments" (still runnable through the form). Reuse `buildRailTree` for the resource segment. Rows are `<button aria-current>`; no tooltips, no `i`.
- [ ] **Step 4:** Run `npm test`.
- [ ] **Step 5:** Commit: `feat: browse column + workspace + home — the deck becomes two permanent regions`

---

### Task 6: Tool subject — one-click run and the form

**Files:**
- Create: `src/ui/deck/ToolView.tsx`, `src/ui/form/ArgsForm.tsx` / `.module.css`
- Delete: `src/ui/deck/ToolDrawer.*`, `src/ui/deck/armState.*`, `src/ui/deck/ToolButton.*`
- Test: `src/ui/deck/DeckView.test.tsx`

**Interfaces:**
- Consumes: `fieldSpecs`/`assembleArgs` (Task 2), `run(name, args)` (Task 3).
- Produces: `ArgsForm` props `{ specs, values, onChange, errors }`.

- [ ] **Step 1:** Write tests: clicking a zero-argument tool calls the client once with `{}` and shows its result; clicking a tool with arguments renders its fields and does **not** call the client until Run; Run is disabled while a required field is empty and the reason is visible as text; a result survives switching subject and coming back; clicking an already-selected zero-arg tool runs it again.
- [ ] **Step 2:** Run — expect failure.
- [ ] **Step 3:** Implement `ToolView` + `ArgsForm`; delete the drawer, arm state and tool button along with their tests.
- [ ] **Step 4:** Run `npm test`.
- [ ] **Step 5:** Commit: `feat: one-click run + schema-driven input forms; drawer and arm state retired`

---

### Task 7: Resource and prompt subjects

**Files:**
- Create: `src/ui/deck/ResourceView.tsx`, `src/ui/deck/PromptView.tsx`
- Delete: `src/ui/deck/Rail.tsx`
- Test: `src/ui/deck/DeckView.test.tsx`

**Interfaces:**
- Consumes: `read(kind, id, args?)` (Task 3), `ArgsForm` (Task 6).

- [ ] **Step 1:** Write tests: selecting a resource loads and renders its contents at full width; selecting a zero-argument prompt loads its messages; a prompt with arguments shows fields and fetches only on **Get prompt**.
- [ ] **Step 2:** Run — expect failure.
- [ ] **Step 3:** Implement both views by lifting the block rendering out of `Rail.tsx`, then delete `Rail.tsx`.
- [ ] **Step 4:** Run `npm test`.
- [ ] **Step 5:** Commit: `feat: resources and prompts open in the workspace; rail retired`

---

### Task 8: Filter, escape, accessibility

**Files:**
- Modify: `src/ui/deck/BrowseColumn.tsx`, `src/ui/deck/Workspace.tsx`, `src/ui/deck/DeckView.tsx`
- Test: `src/ui/deck/DeckView.test.tsx`

- [ ] **Step 1:** Write tests: filtering recedes non-matching rows and auto-opens folders holding matches; segment labels show match counts while filtering; filtering does not change the workspace subject; Escape returns to home; the workspace region is labelled and `aria-live="polite"`.
- [ ] **Step 2:** Run — expect failure.
- [ ] **Step 3:** Implement. Remove `TOOLS_PREVIEW_MAX` / `RAIL_PREVIEW_MAX` and their expanders.
- [ ] **Step 4:** Run `npm test`.
- [ ] **Step 5:** Commit: `feat: column filter with match counts, Escape to home, workspace announcements`

---

### Task 9: Dark mode re-measure

**Files:**
- Modify: `src/global.css` (dark block)

- [ ] **Step 1:** Apply the same proportional strengthening to the dark `--glow-a`/`--glow-b`.
- [ ] **Step 2:** Screenshot dark via the headless rig; sample the most saturated canvas pixel behind small text and compute contrast against `--ink-3` (`#818899`).
- [ ] **Step 3:** If below 4.5:1, lighten dark `--ink-3` until it passes; record both the value and the measured figure in the spec's §7 table.
- [ ] **Step 4:** Run `npm test` (dune parity) and commit: `feat: dark canvas strengthened to match variant E, contrast re-measured`

---

### Task 10: Docs, supersession notes, TODO

**Files:**
- Modify: `docs/functional-description.md`, `docs/architecture-overview.md`, `TODO.md`, and the three superseded specs.

- [ ] **Step 1:** Add a `> **Superseded**` banner to the top of `2026-08-26-luminous-deck-redesign.md`, `2026-08-27-rail-browser-redesign.md` and `2026-08-27-console-drawer-dark-mode.md`, naming which sections this spec replaces and which parts still stand (identity, palette, dark mode mechanism, choreography).
- [ ] **Step 2:** Rewrite the deck sections of `functional-description.md` (column, workspace, home, click contract, forms) and `architecture-overview.md` (new file structure, `StageProps.query`, contexts taking arguments, retired modules).
- [ ] **Step 3:** `TODO.md`: move TODO-1 to Completed noting the scope actually shipped and what remains (nested-object editing beyond the JSON fallback); note in TODO-12 that focus-restore is resolved by deleting the drawer; strike the `?server=` header-preservation item only if actually done (it is not — leave it).
- [ ] **Step 4:** Commit: `docs: sync to the tool-first workspace; supersession banners on three specs`

---

### Task 11: Live QA and reveal shots

- [ ] **Step 1:** Restart `npm run dev` (WSL staleness rule).
- [ ] **Step 2:** Headless pass over the demo server: home, zero-arg run, form run, resource, prompt, filter, dark. Capture the set.
- [ ] **Step 3:** Real-server pass per `public-mcp-test-servers`: deepwiki (unannotated remote tools), Hugging Face (155-resource tree in the column). Fix anything found.
- [ ] **Step 4:** `npm test` and `npm run build`, then commit any fixes: `fix: live-QA fix wave`

---

## Self-Review

**Spec coverage:** §3.1 → Task 4. §3.2 → Tasks 5, 8. §3.3 → Task 5. §4 → Tasks 5, 6, 7. §4.1 → no code (recorded tradeoff). §5 → Tasks 2, 3, 6. §6 → Tasks 5, 6, 7. §7 → Tasks 1, 9. §8 → Task 8. §9 → Task 8. §10 → Tasks 6, 7. §11 → every task's tests. §12 → Task 10's TODO entries.

**Placeholders:** none — each step names its files, its assertions and its command.

**Type consistency:** `fieldSpecs`/`assembleArgs`/`FieldSpec` (Task 2) are used under those names in Task 6; `run(name, args)` / `read(kind, id, args)` (Task 3) match their uses in Tasks 6 and 7; `StageProps.query` (Task 4) matches Task 5's consumption; selection `null` = home is consistent across Tasks 5, 6, 8.
