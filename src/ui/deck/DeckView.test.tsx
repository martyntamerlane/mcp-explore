import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { connectDemo } from "../../mcp/connect"
import type { Connection, ServerSnapshot, TransportKind } from "../../mcp/types"
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
      <DeckView
        snapshot={snapshot}
        transportKind={transportKind}
        selection={selection}
        onSelect={onSelect}
        armTimeoutMs={armTimeoutMs}
      />
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
  expect(within(boundary).getByText(/RESOURCES · 2/)).toBeInTheDocument()
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

test("rail entries select resources and prompts", async () => {
  const { onSelect } = renderDeck()
  await userEvent.click(screen.getByRole("button", { name: "resource config" }))
  expect(onSelect).toHaveBeenCalledWith({ kind: "resource", id: "demo://config" })
  await userEvent.click(screen.getByRole("button", { name: "prompt triage_issue" }))
  expect(onSelect).toHaveBeenCalledWith({ kind: "prompt", id: "triage_issue" })
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

test("tooltips are anchored, described-by wired, for tools and rail entries", () => {
  renderDeck()
  const face = screen.getByRole("button", { name: "tool create_issue" })
  const tipId = face.getAttribute("aria-describedby")
  expect(tipId).toBeTruthy()
  const tip = document.getElementById(tipId!)
  expect(tip).toHaveAttribute("role", "tooltip")
  expect(tip).toHaveTextContent(/create a new issue in the tracker/i)
  const railTipId = screen.getByRole("button", { name: "resource config" }).getAttribute("aria-describedby")
  expect(document.getElementById(railTipId!)).toHaveTextContent(/tracker configuration/i)
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
