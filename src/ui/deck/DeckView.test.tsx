import { useState } from "react"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { connectDemo } from "../../mcp/connect"
import type { Connection, ServerSnapshot, TransportKind } from "../../mcp/types"
import { ReadProvider } from "../run/ReadContext"
import { RunProvider } from "../run/RunContext"
import type { EntitySelection } from "../stage"
import DeckView from "./DeckView"

let conn: Connection
beforeAll(async () => {
  conn = await connectDemo()
})
afterAll(async () => {
  await conn.close()
})

/**
 * The stage owns selection in the real app (App does), so the harness mirrors
 * that: it keeps selection in a wrapper and re-renders, which is what makes the
 * "run on select" contract testable end to end.
 */
interface HarnessProps {
  snapshot: ServerSnapshot
  transportKind: TransportKind
  query: string
  onSelect: (next: EntitySelection | null) => void
}

function Harness({ snapshot, transportKind, query, onSelect }: HarnessProps) {
  const [selection, setSelection] = useState<EntitySelection | null>(null)
  return (
    <DeckView
      snapshot={snapshot}
      transportKind={transportKind}
      selection={selection}
      onSelect={(next) => {
        onSelect(next)
        setSelection(next)
      }}
      query={query}
    />
  )
}

function renderDeck({
  transportKind = "in-memory" as TransportKind,
  snapshot = conn.snapshot,
  query = "",
} = {}) {
  const onSelect = vi.fn()
  const tree = (props: Partial<HarnessProps>) => (
    <RunProvider connection={conn}>
      <ReadProvider connection={conn}>
        <Harness
          snapshot={snapshot}
          transportKind={transportKind}
          query={query}
          onSelect={onSelect}
          {...props}
        />
      </ReadProvider>
    </RunProvider>
  )
  const utils = render(tree({}))
  // Re-rendering the same Harness in place keeps its selection state, which is
  // how App behaves when only the filter or the snapshot changes.
  return { onSelect, update: (props: Partial<HarnessProps>) => utils.rerender(tree(props)) }
}

afterEach(() => {
  vi.restoreAllMocks()
})

const workspace = () => screen.getByRole("region", { name: "Workspace" })

test("home is the resting subject and carries the server's own instructions", () => {
  renderDeck()
  expect(within(workspace()).getByText(/simulated issue tracker/i)).toBeInTheDocument()
  expect(within(workspace()).getByText("6")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Home" })).toHaveAttribute("aria-current", "true")
})

test("a server with no instructions says so rather than showing an empty panel", () => {
  const snapshot: ServerSnapshot = { ...conn.snapshot, instructions: undefined }
  renderDeck({ snapshot })
  expect(within(workspace()).getByText(/publishes no instructions/i)).toBeInTheDocument()
})

test("the column segments the three kinds with counts and swaps lists", async () => {
  renderDeck()
  expect(screen.getByRole("button", { name: /^Tools/ })).toHaveTextContent("6")
  expect(screen.getByRole("button", { name: "tool project_pulse" })).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "prompt triage_issue" })).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole("button", { name: /^Prompts/ }))
  expect(screen.getByRole("button", { name: "prompt triage_issue" })).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "tool project_pulse" })).not.toBeInTheDocument()
})

test("a zero-argument tool runs on a single click", async () => {
  const spy = vi.spyOn(conn.client, "callTool")
  renderDeck()
  await userEvent.click(screen.getByRole("button", { name: "tool project_pulse" }))
  expect(spy).toHaveBeenCalledExactlyOnceWith({ name: "project_pulse", arguments: {} })
  expect(await within(workspace()).findByText(/mcp-explore demo/)).toBeInTheDocument()
})

test("clicking an already-open zero-argument tool runs it again", async () => {
  const spy = vi.spyOn(conn.client, "callTool")
  renderDeck()
  const row = screen.getByRole("button", { name: "tool project_pulse" })
  await userEvent.click(row)
  await within(workspace()).findByText(/mcp-explore demo/)
  await userEvent.click(row)
  await waitFor(() => expect(spy).toHaveBeenCalledTimes(2))
})

test("a tool with arguments opens its fields and does not run until Run", async () => {
  const spy = vi.spyOn(conn.client, "callTool")
  renderDeck()
  await userEvent.click(screen.getByRole("button", { name: "tool create_issue" }))
  expect(spy).not.toHaveBeenCalled()

  const title = screen.getByLabelText(/^title/)
  await userEvent.type(title, "Graph mis-renders")
  await userEvent.click(screen.getByRole("button", { name: /run create_issue/i }))

  expect(spy).toHaveBeenCalledExactlyOnceWith({
    name: "create_issue",
    arguments: { title: "Graph mis-renders" },
  })
  expect(await within(workspace()).findByText(/created issue #104/i)).toBeInTheDocument()
})

test("Run is blocked while a required argument is empty, and says why", async () => {
  const tools = [
    {
      name: "needs_args",
      inputSchema: {
        type: "object" as const,
        properties: { who: { type: "string" } },
        required: ["who"],
      },
    },
  ]
  renderDeck({ snapshot: { ...conn.snapshot, tools } })
  await userEvent.click(screen.getByRole("button", { name: "tool needs_args" }))
  const run = screen.getByRole("button", { name: /run needs_args/i })
  expect(run).toBeDisabled()
  expect(screen.getByText(/fill who to run/i)).toBeInTheDocument()

  await userEvent.type(screen.getByLabelText(/^who/), "you")
  expect(screen.getByRole("button", { name: /run needs_args/i })).toBeEnabled()
})

test("unsupported schema shapes fall back to an honest JSON field", async () => {
  const tools = [
    {
      name: "odd_tool",
      inputSchema: {
        type: "object" as const,
        properties: { payload: { type: "object", properties: { a: { type: "string" } } } },
      },
    },
  ]
  renderDeck({ snapshot: { ...conn.snapshot, tools } })
  await userEvent.click(screen.getByRole("button", { name: "tool odd_tool" }))
  const field = screen.getByLabelText(/^payload/)
  expect(field.tagName).toBe("TEXTAREA")
})

test("a run result survives switching subject and coming back", async () => {
  renderDeck()
  await userEvent.click(screen.getByRole("button", { name: "tool project_pulse" }))
  await within(workspace()).findByText(/mcp-explore demo/)
  await userEvent.click(screen.getByRole("button", { name: "Home" }))
  expect(within(workspace()).queryByText(/mcp-explore demo/)).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole("button", { name: "tool list_issues" }))
  await userEvent.click(screen.getByRole("button", { name: "tool project_pulse" }))
  expect(await within(workspace()).findByText(/mcp-explore demo/)).toBeInTheDocument()
})

test("a part-filled form survives switching subject and coming back", async () => {
  renderDeck()
  await userEvent.click(screen.getByRole("button", { name: "tool create_issue" }))
  await userEvent.type(screen.getByLabelText(/^title/), "half typed")
  await userEvent.click(screen.getByRole("button", { name: "Home" }))
  await userEvent.click(screen.getByRole("button", { name: "tool create_issue" }))
  expect(screen.getByLabelText(/^title/)).toHaveValue("half typed")
})

test("read-only tools are badged; unannotated ones claim nothing", () => {
  renderDeck()
  expect(within(screen.getByRole("button", { name: "tool project_pulse" })).getByText("read only")).toBeInTheDocument()
  expect(within(screen.getByRole("button", { name: "tool create_issue" })).queryByText("read only")).toBeNull()
})

test("selecting a resource loads and renders its contents in the workspace", async () => {
  renderDeck()
  await userEvent.click(screen.getByRole("button", { name: /^Resources/ }))
  await userEvent.click(screen.getByRole("button", { name: "resource config" }))
  expect(await within(workspace()).findByText(/defaultPriority/)).toBeInTheDocument()
  expect(within(workspace()).getByText("demo://config")).toBeInTheDocument()
  expect(within(workspace()).getByText("application/json")).toBeInTheDocument()
})

test("path-structured resources group into folders; a folder click reveals children", async () => {
  renderDeck()
  await userEvent.click(screen.getByRole("button", { name: /^Resources/ }))
  expect(screen.queryByRole("button", { name: "resource getting-started" })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole("button", { name: "folder docs" }))
  expect(screen.getByRole("button", { name: "resource getting-started" })).toBeInTheDocument()
  expect(within(screen.getByRole("button", { name: "folder issues" })).getByText("3")).toBeInTheDocument()
})

test("a zero-argument prompt loads its messages on selection", async () => {
  renderDeck()
  await userEvent.click(screen.getByRole("button", { name: /^Prompts/ }))
  await userEvent.click(screen.getByRole("button", { name: "prompt weekly_summary" }))
  expect(await within(workspace()).findByText(/three bullet points/)).toBeInTheDocument()
})

test("a prompt with arguments waits for Get prompt", async () => {
  const spy = vi.spyOn(conn.client, "getPrompt")
  renderDeck()
  await userEvent.click(screen.getByRole("button", { name: /^Prompts/ }))
  await userEvent.click(screen.getByRole("button", { name: "prompt triage_issue" }))
  expect(spy).not.toHaveBeenCalled()

  const get = screen.getByRole("button", { name: /get prompt/i })
  expect(get).toBeDisabled()
  await userEvent.type(screen.getByLabelText(/^issue_id/), "101")
  await userEvent.click(screen.getByRole("button", { name: /get prompt/i }))

  expect(spy).toHaveBeenCalledExactlyOnceWith({ name: "triage_issue", arguments: { issue_id: "101" } })
  expect(await within(workspace()).findByText(/triage issue 101/i)).toBeInTheDocument()
})

test("the filter recedes non-matching rows and reports per-kind hits", async () => {
  renderDeck({ query: "pulse" })
  expect(screen.getByRole("button", { name: "tool project_pulse" })).not.toHaveAttribute("data-receded")
  expect(screen.getByRole("button", { name: "tool create_issue" })).toHaveAttribute("data-receded")
  expect(screen.getByRole("button", { name: /^Tools/ })).toHaveTextContent("1")
  expect(screen.getByRole("button", { name: /^Resources/ })).toHaveTextContent("0")
})

test("an active filter forces folders open so nested matches are visible", async () => {
  renderDeck({ query: "getting" })
  await userEvent.click(screen.getByRole("button", { name: /^Resources/ }))
  const match = screen.getByRole("button", { name: "resource getting-started" })
  expect(match).not.toHaveAttribute("data-receded")
  expect(screen.getByRole("button", { name: "folder issues" }).closest("[data-receded]")).not.toBeNull()
})

test("filtering never changes the workspace subject", async () => {
  const { update } = renderDeck()
  await userEvent.click(screen.getByRole("button", { name: "tool project_pulse" }))
  await within(workspace()).findByText(/mcp-explore demo/)
  update({ query: "create" })
  expect(within(workspace()).getByRole("heading", { name: "project_pulse" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "tool project_pulse" })).toHaveAttribute("data-receded")
})

test("Escape returns to home", async () => {
  renderDeck()
  await userEvent.click(screen.getByRole("button", { name: "tool create_issue" }))
  expect(within(workspace()).getByText(/create a new issue/i)).toBeInTheDocument()
  await userEvent.keyboard("{Escape}")
  expect(within(workspace()).getByText(/simulated issue tracker/i)).toBeInTheDocument()
})

test("empty kinds say so honestly", async () => {
  renderDeck({ snapshot: { ...conn.snapshot, resources: [], prompts: [] } })
  await userEvent.click(screen.getByRole("button", { name: /^Resources/ }))
  expect(screen.getByText(/exposes no resources/i)).toBeInTheDocument()
  await userEvent.click(screen.getByRole("button", { name: /^Prompts/ }))
  expect(screen.getByText(/exposes no prompts/i)).toBeInTheDocument()
})

test("a subject that vanishes from the snapshot is reported, not blank", async () => {
  const { update } = renderDeck()
  await userEvent.click(screen.getByRole("button", { name: "tool project_pulse" }))
  expect(within(workspace()).getByRole("heading", { name: "project_pulse" })).toBeInTheDocument()
  update({ snapshot: { ...conn.snapshot, tools: [] } })
  expect(within(workspace()).getByText(/no longer present/i)).toBeInTheDocument()
})
