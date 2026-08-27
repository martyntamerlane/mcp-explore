import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { connectDemo } from "../../mcp/connect"
import type { Connection, ServerSnapshot, TransportKind } from "../../mcp/types"
import { ReadProvider } from "../run/ReadContext"
import { RunProvider } from "../run/RunContext"
import type { EntitySelection } from "../stage"
import DeckView, { TOOLS_PREVIEW_MAX } from "./DeckView"

let conn: Connection
beforeAll(async () => {
  conn = await connectDemo()
})
afterAll(async () => {
  await conn.close()
})

function renderDeck({
  transportKind = "in-memory" as TransportKind,
  snapshot = conn.snapshot,
  selection = null as EntitySelection | null,
  armTimeoutMs = undefined as number | undefined,
} = {}) {
  const onSelect = vi.fn()
  render(
    <RunProvider connection={conn}>
      <ReadProvider connection={conn}>
        <DeckView
          snapshot={snapshot}
          transportKind={transportKind}
          selection={selection}
          onSelect={onSelect}
          armTimeoutMs={armTimeoutMs}
        />
      </ReadProvider>
    </RunProvider>,
  )
  return { onSelect }
}

afterEach(() => {
  vi.restoreAllMocks()
})

test("deck boundary carries server identity and canonical section headers", () => {
  renderDeck()
  const boundary = screen.getByRole("region", { name: /server demo-issue-tracker/i })
  expect(within(boundary).getByText(/v1\.0\.0/)).toBeInTheDocument()
  expect(within(boundary).getByText("in-memory")).toBeInTheDocument()
  expect(within(boundary).getByText(/TOOLS · 6/)).toBeInTheDocument()
  expect(within(boundary).getByText(/RESOURCES · 7/)).toBeInTheDocument()
  expect(within(boundary).getByText(/PROMPTS · 2/)).toBeInTheDocument()
  expect(within(boundary).getByText("actions it can perform")).toBeInTheDocument()
  expect(within(boundary).getByText("data it exposes")).toBeInTheDocument()
  expect(within(boundary).getByText("ready-made instructions")).toBeInTheDocument()
})

test("instant class (readOnlyHint): a single click runs and selects", async () => {
  const spy = vi.spyOn(conn.client, "callTool").mockResolvedValue({ content: [] })
  const { onSelect } = renderDeck()
  await userEvent.click(screen.getByRole("button", { name: "tool project_pulse" }))
  expect(spy).toHaveBeenCalledExactlyOnceWith({ name: "project_pulse", arguments: {} })
  expect(onSelect).toHaveBeenCalledWith({ kind: "tool", id: "project_pulse" })
})

test("arm class: first click arms without running, second fires exactly once", async () => {
  const spy = vi.spyOn(conn.client, "callTool").mockResolvedValue({ content: [] })
  const { onSelect } = renderDeck()
  const face = screen.getByRole("button", { name: "tool create_issue" })
  await userEvent.click(face)
  expect(spy).not.toHaveBeenCalled()
  expect(onSelect).not.toHaveBeenCalled()
  const armed = screen.getByRole("button", { name: "Run create_issue" })
  expect(armed).toHaveAttribute("aria-pressed", "true")
  await userEvent.click(armed)
  expect(spy).toHaveBeenCalledExactlyOnceWith({ name: "create_issue", arguments: {} })
  expect(onSelect).toHaveBeenCalledWith({ kind: "tool", id: "create_issue" })
})

test("Escape disarms", async () => {
  const spy = vi.spyOn(conn.client, "callTool").mockResolvedValue({ content: [] })
  renderDeck()
  await userEvent.click(screen.getByRole("button", { name: "tool create_issue" }))
  await userEvent.keyboard("{Escape}")
  expect(screen.queryByRole("button", { name: "Run create_issue" })).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "tool create_issue" })).toHaveAttribute("aria-pressed", "false")
  expect(spy).not.toHaveBeenCalled()
})

test("arming a second tool re-arms — only one armed at a time", async () => {
  renderDeck()
  await userEvent.click(screen.getByRole("button", { name: "tool create_issue" }))
  await userEvent.click(screen.getByRole("button", { name: "tool close_issue" }))
  expect(screen.queryByRole("button", { name: "Run create_issue" })).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Run close_issue" })).toBeInTheDocument()
})

test("an armed button times out and disarms (injectable timeout)", async () => {
  renderDeck({ armTimeoutMs: 40 })
  await userEvent.click(screen.getByRole("button", { name: "tool create_issue" }))
  expect(screen.getByRole("button", { name: "Run create_issue" })).toBeInTheDocument()
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Run create_issue" })).not.toBeInTheDocument(),
  )
})

test("the info icon opens details without ever running", async () => {
  const spy = vi.spyOn(conn.client, "callTool").mockResolvedValue({ content: [] })
  const { onSelect } = renderDeck()
  await userEvent.click(screen.getByRole("button", { name: "details create_issue" }))
  expect(onSelect).toHaveBeenCalledWith({ kind: "tool", id: "create_issue" })
  expect(spy).not.toHaveBeenCalled()
})

test("input-required class: click opens details, never runs, face is signposted", async () => {
  const spy = vi.spyOn(conn.client, "callTool").mockResolvedValue({ content: [] })
  const snapshot: ServerSnapshot = {
    ...conn.snapshot,
    tools: [
      {
        name: "needs_args",
        description: "Requires input.",
        inputSchema: { type: "object", properties: { q: { type: "string" } }, required: ["q"] },
      },
    ],
  }
  const { onSelect } = renderDeck({ transportKind: "streamable-http", snapshot })
  const face = screen.getByRole("button", { name: "tool needs_args" })
  expect(within(face).getByText(/needs input/i)).toBeInTheDocument()
  await userEvent.click(face)
  expect(onSelect).toHaveBeenCalledWith({ kind: "tool", id: "needs_args" })
  expect(spy).not.toHaveBeenCalled()
})

test("keyboard: Enter arms, Enter fires", async () => {
  const spy = vi.spyOn(conn.client, "callTool").mockResolvedValue({ content: [] })
  renderDeck()
  const face = screen.getByRole("button", { name: "tool create_issue" })
  face.focus()
  await userEvent.keyboard("{Enter}")
  expect(screen.getByRole("button", { name: "Run create_issue" })).toBeInTheDocument()
  await userEvent.keyboard("{Enter}")
  expect(spy).toHaveBeenCalledExactlyOnceWith({ name: "create_issue", arguments: {} })
})

test("resource rows unfold in place and auto-load contents — the panel is never involved", async () => {
  const { onSelect } = renderDeck()
  const row = screen.getByRole("button", { name: "resource config" })
  expect(row).toHaveAttribute("aria-expanded", "false")
  await userEvent.click(row)
  expect(row).toHaveAttribute("aria-expanded", "true")
  await waitFor(() => expect(screen.getByText(/defaultPriority/)).toBeInTheDocument())
  expect(screen.getByText("demo://config")).toBeInTheDocument()
  expect(screen.getByText("application/json")).toBeInTheDocument()
  expect(onSelect).not.toHaveBeenCalled()
  // clicking the open row folds it back
  await userEvent.click(row)
  expect(row).toHaveAttribute("aria-expanded", "false")
})

test("accordion: unfolding a second row folds the first", async () => {
  renderDeck()
  const config = screen.getByRole("button", { name: "resource config" })
  const readme = screen.getByRole("button", { name: "resource readme" })
  await userEvent.click(config)
  await userEvent.click(readme)
  expect(config).toHaveAttribute("aria-expanded", "false")
  expect(readme).toHaveAttribute("aria-expanded", "true")
})

test("path-structured resources group into folders; a folder click reveals children", async () => {
  renderDeck()
  expect(screen.queryByRole("button", { name: "resource getting-started" })).not.toBeInTheDocument()
  const docs = screen.getByRole("button", { name: "folder docs" })
  expect(docs).toHaveAttribute("aria-expanded", "false")
  await userEvent.click(docs)
  expect(screen.getByRole("button", { name: "resource getting-started" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "resource writing-good-issues" })).toBeInTheDocument()
  expect(within(screen.getByRole("button", { name: "folder issues" })).getByText("3")).toBeInTheDocument()
})

test("zero-arg prompts unfold to their actual message text; parameterised show args honestly", async () => {
  const spy = vi.spyOn(conn.client, "getPrompt")
  renderDeck()
  await userEvent.click(screen.getByRole("button", { name: "prompt weekly_summary" }))
  await waitFor(() => expect(screen.getByText(/three bullet points/)).toBeInTheDocument())
  expect(screen.getByText("USER")).toBeInTheDocument()
  await userEvent.click(screen.getByRole("button", { name: "prompt triage_issue" }))
  expect(screen.getByText("issue_id")).toBeInTheDocument()
  expect(screen.getByText(/fill-in preview — coming with tool forms/)).toBeInTheDocument()
  // parameterised prompts are never fetched
  expect(spy).toHaveBeenCalledExactlyOnceWith({ name: "weekly_summary" })
})

test("an active filter forces folders open so nested matches are visible", async () => {
  renderDeck()
  await userEvent.type(screen.getByLabelText(/filter items/i), "getting")
  const match = screen.getByRole("button", { name: "resource getting-started" })
  expect(match.closest("[data-receded]")).toBeNull()
  // the folder holding no matches recedes with its contents
  expect(screen.getByRole("button", { name: "folder issues" }).closest("[data-receded]")).not.toBeNull()
})

test("rail preview cap counts top-level rows — a folder is one row", async () => {
  const resources = Array.from({ length: 12 }, (_, i) => ({
    uri: `flat://r${String(i).padStart(2, "0")}`,
    name: `r${String(i).padStart(2, "0")}`,
  }))
  renderDeck({ snapshot: { ...conn.snapshot, resources } })
  expect(screen.queryByRole("button", { name: "resource r11" })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole("button", { name: /show all 12 resources/i }))
  expect(screen.getByRole("button", { name: "resource r11" })).toBeInTheDocument()
})

test("filter recedes non-matches across all kinds and bypasses the preview cap", async () => {
  const many = Array.from({ length: TOOLS_PREVIEW_MAX + 2 }, (_, i) => ({
    name: `bulk_${String(i).padStart(2, "0")}`,
    inputSchema: { type: "object" as const },
  }))
  const snapshot: ServerSnapshot = { ...conn.snapshot, tools: many }
  renderDeck({ snapshot })
  // capped at rest
  expect(screen.queryByRole("button", { name: "tool bulk_25" })).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: /show all 26 tools/i })).toHaveTextContent("+ 2 more")
  // active filter searches everything
  await userEvent.type(screen.getByLabelText(/filter items/i), "bulk_25")
  const match = screen.getByRole("button", { name: "tool bulk_25" })
  expect(match).toBeInTheDocument()
  expect(match.closest("[data-receded]")).toBeNull()
  expect(screen.getByRole("button", { name: "tool bulk_00" }).closest("[data-receded]")).not.toBeNull()
  // rail recedes too
  expect(screen.getByRole("button", { name: "resource config" }).closest("[data-receded]")).not.toBeNull()
})

test("expander reveals the full grid and collapses back", async () => {
  const many = Array.from({ length: TOOLS_PREVIEW_MAX + 2 }, (_, i) => ({
    name: `bulk_${String(i).padStart(2, "0")}`,
    inputSchema: { type: "object" as const },
  }))
  renderDeck({ snapshot: { ...conn.snapshot, tools: many } })
  await userEvent.click(screen.getByRole("button", { name: /show all 26 tools/i }))
  expect(screen.getByRole("button", { name: "tool bulk_25" })).toBeInTheDocument()
  await userEvent.click(screen.getByRole("button", { name: /show fewer tools/i }))
  expect(screen.queryByRole("button", { name: "tool bulk_25" })).not.toBeInTheDocument()
})

test("scrolling and clicking elsewhere both disarm", async () => {
  renderDeck()
  await userEvent.click(screen.getByRole("button", { name: "tool create_issue" }))
  expect(screen.getByRole("button", { name: "Run create_issue" })).toBeInTheDocument()
  fireEvent.scroll(window)
  expect(screen.queryByRole("button", { name: "Run create_issue" })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole("button", { name: "tool create_issue" }))
  fireEvent.pointerDown(document.body)
  expect(screen.queryByRole("button", { name: "Run create_issue" })).not.toBeInTheDocument()
})

test("tool tooltips are anchored and described-by wired; rail rows have none", () => {
  renderDeck()
  const face = screen.getByRole("button", { name: "tool create_issue" })
  const tipId = face.getAttribute("aria-describedby")
  expect(tipId).toBeTruthy()
  const tip = document.getElementById(tipId!)
  expect(tip).toHaveAttribute("role", "tooltip")
  expect(tip).toHaveTextContent(/create a new issue in the tracker/i)
  // rail rows retired their tooltip — the description lives in the unfolded row
  expect(screen.getByRole("button", { name: "resource config" })).not.toHaveAttribute("aria-describedby")
})

test("reduced motion: the deck's content renders synchronously with no entrance", () => {
  // useReducedMotion reads matchMedia, which jsdom doesn't provide — stub it
  // so the reduce query matches.
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  )
  try {
    renderDeck()
    // the entrance branch must not gate first paint: every section is present at once
    expect(screen.getByRole("button", { name: "tool project_pulse" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "resource config" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "prompt triage_issue" })).toBeInTheDocument()
  } finally {
    vi.unstubAllGlobals()
  }
})

test("empty kinds render an honest none line", () => {
  renderDeck({ snapshot: { ...conn.snapshot, resources: [], prompts: [] } })
  expect(screen.getAllByText("none")).toHaveLength(2)
})
