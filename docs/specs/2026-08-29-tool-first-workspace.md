# Tool-first workspace — design

**Date**: 2026-08-29
**Status**: agreed, not yet implemented
**Supersedes**: the deck body layout in [`2026-08-26-luminous-deck-redesign.md`](2026-08-26-luminous-deck-redesign.md) §3–§5, the rail's in-place unfold in [`2026-08-27-rail-browser-redesign.md`](2026-08-27-rail-browser-redesign.md), and the console drawer in [`2026-08-27-console-drawer-dark-mode.md`](2026-08-27-console-drawer-dark-mode.md) §2. The identity, palette and choreography of the luminous-deck redesign carry forward unchanged except where §7 says otherwise.
**Mockups**: [`docs/mockups/2026-08-29-run-layouts/`](../mockups/2026-08-29-run-layouts/index.html) — layout options 1/2/4, background strengths A–E.

## 1. Why

The connected view was assembled from four specs written in sequence, each of which designed its component correctly and at full strength. Nothing ever ranked them against each other, so they compete:

- **Three chrome bands, two prism marks.** App header, deck header and section headers stack within 100px, none claiming primacy.
- **Two card languages of equal weight, opposite behaviour.** Tool cards and rail rows are both ~44px rounded hairline boxes with a coloured dot; one arms-then-fires, the other unfolds.
- **Three accent hues lit at rest**, against the redesign's own rule that rest states stay near-monochrome and colour is earned by interaction.
- **Vertical collapse.** Tools occupy the top ~180px of a full-height boundary; the rest is empty, with a divider running down through nothing. Opening the drawer then squeezes everything into the top 60%.
- **Six layers explaining one tool**: section header, gloss, card label, tooltip, `i` button, drawer.
- **The last overlay.** The tooltip still pops over the grid, and can be lit simultaneously with the drawer showing the same sentence.

Separately, the run mechanism was unintuitive. `classifyTool` grants single-click only to tools annotated `readOnlyHint: true`; almost no server in the wild sets annotations, so in practice every tool on every real server landed in the arm-then-fire class. A guard that fires on effectively 100% of tools carries no information and reads as friction.

## 2. Decisions

1. **Tools are the subject.** Resources and prompts are peers in navigation but not in prominence.
2. **One click runs a tool.** No arm, no confirm — including for unannotated tools (§4.1 records the tradeoff).
3. **Tools with arguments ask for them.** A form generated from `inputSchema`; its Run button is the commit (TODO-1, scoped in §5).
4. **One subject on screen at a time.** A permanent browsing column and a permanent workspace. Tools, resources and prompts all open into the workspace.
5. **Home is the server's own instructions.** The workspace's resting state, reachable at any time.
6. **Nothing appears, slides or overlays.** Both regions are permanent furniture. The console drawer and the tooltip are deleted.

## 3. Layout

### 3.1 Chrome — one band

A single 58px band replaces the app header and the deck header:

`[prism] MCP EXPLORE │ <server name> (v<version>) (<transport>)  …  [filter] [mode toggle] [Disconnect]`

The inner boundary card (border, radius, backdrop blur, 20px margin) is removed — it framed a frame. The multi-server seam (TODO-16) survives: a tiled layout gives each server its own band plus column/workspace pair.

### 3.2 Browsing column — 300px, left

- A home control at the top, above a segmented control: `Tools <n> · Resources <n> · Prompts <n>`.
- One segment's list is visible at a time. Tools and prompts are flat lists; resources keep the folder tree from `railTree.ts` (the 155-resource case it was built for).
- Rows are monochrome at rest. The selected row carries a sustained tinted edge in its kind's accent — colour earned by interaction, one accent lit at a time.
- Tool rows show a `read only` badge when the server sets `readOnlyHint: true`, and nothing otherwise.
- No dots, no `i` buttons, no tooltips.

### 3.3 Workspace — fills the remainder

Separated from the column by a hairline, not a card. Holds exactly one subject: home, a tool, a resource, or a prompt. Switching subjects cross-fades content; the region itself never moves.

## 4. Click contract

| Subject | One click does |
|---|---|
| Tool, zero arguments | Runs it. Result lands in the workspace. |
| Tool with arguments | Opens it in the workspace with its fields; **Run** commits. |
| Resource | Opens it in the workspace and loads its contents. |
| Prompt, zero arguments | Opens it and loads its messages. |
| Prompt with arguments | Opens it with its fields; **Get prompt** commits. |
| Home | Returns to the server's instructions. |

On connect the workspace shows home; no subject is auto-selected. Selecting a tool that has already run shows its retained result; clicking a zero-argument tool that is *already* the subject runs it again. Runs remain one-in-flight-per-tool via `RunContext`'s existing guard.

`armState.ts`, `ARM_TIMEOUT_MS`, the arm/disarm listeners, the `instant`/`arm` split in `RunClass`, and `ToolButton`'s tooltip and `i` button are all deleted.

### 4.1 Recorded tradeoff — no destructive guard

A zero-argument, unannotated, destructive tool on a user-supplied server (`close_issue`, `wipe_cache`) fires from a single click with no undo and no confirmation. This was raised and the user chose it deliberately over guarding either everything unflagged (which reproduces today's friction) or only `destructiveHint: true` tools.

Mitigations that remain in place: the app only ever connects to a server the user typed; nothing runs automatically on connect; `?server=` auto-connect lists but never invokes. If this proves wrong in real use, the narrowest fix is a confirm gated on `destructiveHint === true` — `classifyTool` is the seam.

## 5. Input forms (TODO-1, scoped)

Fields are generated from `inputSchema` via `schemaRows`, which already narrows untrusted schemas defensively.

| Schema | Control |
|---|---|
| `string` | text input |
| `string` with `enum` | segmented control |
| `number`, `integer` | numeric input |
| `boolean` | toggle |
| `array` of `string` | token input |
| anything else (nested object, array of objects, `oneOf`/`anyOf`, absent `type`) | JSON textarea labelled with the raw type |

Rules:

- Schema `default` values prefill. Descriptions render beneath their field.
- Required fields are marked; **Run** is disabled until all are non-empty, with the reason stated next to it rather than in a tooltip.
- Optional fields left empty are **omitted** from the arguments object — never sent as `""` or `null`.
- Numeric inputs that don't parse block Run with an inline message; JSON textareas that don't parse do the same.
- Values live per tool for the session, so switching away and back preserves a part-filled form. Not persisted across reloads.
- Prompt arguments (`name` / `description` / `required`, always strings per the MCP spec) reuse the same form component.

`RunContext.run` must take an arguments object; today it hardcodes `arguments: {}`.

## 6. Workspace content

**Home.** Server name, version, transport, capability counts, and the server's `instructions` string — captured in `ServerSnapshot.instructions` since the scaffold and rendered nowhere until now. Servers that send no instructions get the identity block plus a plain line saying this server publishes none; no empty-state illustration, no placeholder.

**Tool.** Name, description, the form (or, for zero-argument tools, a Run control and the note that it takes no arguments), and the result. Raw JSON of the tool definition stays available behind a disclosure. Results use `runResult.ts` formatting and its `MAX_RESULT_CHARS` cap; errors land flat with no success motion, as today.

**Resource.** Name, URI, MIME type, description, then contents via `ReadContext` and `readResult.ts` — text, JSON and images as they render in the rail fold today, but at full width. Load is triggered by selection and cached as it is now.

**Prompt.** Name, description, arguments form if any, then the returned messages.

Failures anywhere reuse the existing retryable error rendering.

## 7. Palette

Canvas moves to mockup variant E:

```
--bg: #eaf0f8
--glow-a: rgba(8, 145, 178, 0.20)   /* radial 1050×820 at 10% -14%, transparent 64% */
--glow-b: rgba(109, 40, 217, 0.12)  /* radial 1100×880 at 94% 114%, transparent 62% */
--header-bg: rgba(238, 244, 251, 0.72)
--ink-3: #5a6070                     /* was #666c82 */
```

Measured on the rendered mockups — smallest grey text against the most saturated canvas pixel behind it, project floor 4.5:1:

| variant | worst contrast |
|---|---|
| today (teal .07 / violet .05) | 4.65 |
| E, before the ink change | 4.05 |
| **E** | **4.88** |

Dark mode receives the same strengthening and must be re-measured, not assumed to transfer — `--ink-3` there is `#818899` on `#0f141c`. Entity accents, `--code-bg`, and the dune parity contract in `src/dune/theme.test.ts` are unchanged; `--ink-3` is not on that allowlist.

Motion: entrance choreography stays. The drawer's height animation goes with the drawer. Workspace content cross-fades on subject change (~160ms), instant under `prefers-reduced-motion`.

## 8. Filter

The filter box in the chrome band filters the active segment's list only. Non-matching rows recede as they do today; folders auto-expand to reveal matches. While a filter is active the segmented control shows each kind's match count, so a match hiding in another segment is visible. Filtering never changes the workspace's subject. The `TOOLS_PREVIEW_MAX` cap and its `+ N more` expander are retired — a scrolling column doesn't need a cap.

## 9. Accessibility

- Selecting a row does not move focus; the row is a button carrying `aria-current`, and the workspace is a labelled region announcing its new subject via `aria-live="polite"`.
- Run state announcements (`aria-live` / `role="alert"`) carry over from the current drawer.
- This resolves TODO-12's open "focus moves into / restores from the drawer" item by deleting the surface. The remaining TODO-12 entries (enum chips keyed by index, `?server=` header preservation, `loadRecents` shape validation) are untouched and stay open.
- Escape clears the workspace back to home. Nothing else listens for Escape once arming is gone.

## 10. Retired

`ToolDrawer.tsx` + `.module.css` + tests · `armState.ts` + tests · `ToolButton`'s tooltip, `i` button, and armed/running/selected card states beyond the selected row treatment · `RunClass`'s `instant`/`arm` distinction · `DeckEmphasis` / `data-emphasis` tool-light branch (a permanent workspace can't produce a vast empty centre) · `TOOLS_PREVIEW_MAX`.

Retained and reused: `railTree.ts`, `schema.ts`, `runResult.ts`, `readResult.ts`, `RunContext`, `ReadContext`, `choreography.ts`, `Prism`, `Glyph`, `ModeToggle`.

`src/dune/` is untouched — that subsystem belongs to a parallel session.

## 11. Testing

- **Tier 1**: schema → control mapping including the unsupported-type fallback; argument assembly (empty optionals omitted, defaults applied, numbers coerced); required-field gating; `buildDeckModel` without the emphasis branch.
- **Tier 2**: zero-arg tool runs on one click; a tool with arguments does not run until Run is pressed; a result survives switching subject and returning; a resource loads on selection; home renders instructions, and renders the no-instructions case.
- Existing `DeckView`, `ToolDrawer` and `armState` tests are rewritten or deleted with their subjects.

## 12. Out of scope

- **Landing page.** The demo door still outweighs the connect form, which is the app's actual purpose. Separate pass.
- **Multi-server tiling** (TODO-16) — the chrome band keeps the seam open.
- **Semantic grouping** (TODO-4) — the browsing column's list is the grouping seam.
- Font, prism-variant and grain picks from the luminous-deck reveal remain open and independent of this work.
