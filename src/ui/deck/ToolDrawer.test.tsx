import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
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

// The drawer is DeckView-internal, so it is tested through the stage with a
// stateful harness standing in for App's selection ownership.
function Harness({
  snapshot = conn.snapshot,
  transportKind = "in-memory" as TransportKind,
  initial = null as EntitySelection | null,
}) {
  const [selection, setSelection] = useState<EntitySelection | null>(initial)
  return (
    <RunProvider connection={conn}>
      <ReadProvider connection={conn}>
        <DeckView snapshot={snapshot} transportKind={transportKind} selection={selection} onSelect={setSelection} />
      </ReadProvider>
    </RunProvider>
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

test("info icon opens the drawer with identity, description, and the arguments table", async () => {
  render(<Harness />)
  expect(screen.queryByRole("region", { name: /tool details/i })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole("button", { name: "details create_issue" }))
  const drawer = await screen.findByRole("region", { name: "tool details create_issue" })
  expect(within(drawer).getByText(/create a new issue/i)).toBeInTheDocument()
  expect(within(drawer).getByText("title")).toBeInTheDocument()
  // enum chips from the priority argument
  expect(within(drawer).getByText("low")).toBeInTheDocument()
  expect(within(drawer).getByText("high")).toBeInTheDocument()
})

test("firing a tool lands its result in the drawer", async () => {
  render(<Harness />)
  await userEvent.click(screen.getByRole("button", { name: "tool project_pulse" }))
  const drawer = await screen.findByRole("region", { name: "tool details project_pulse" })
  await waitFor(() => expect(within(drawer).getByText(/▂▄▃▆▅█▇/)).toBeInTheDocument())
})

test("selecting another tool swaps drawer content in place", async () => {
  render(<Harness />)
  await userEvent.click(screen.getByRole("button", { name: "details create_issue" }))
  await screen.findByRole("region", { name: "tool details create_issue" })
  await userEvent.click(screen.getByRole("button", { name: "details close_issue" }))
  expect(await screen.findByRole("region", { name: "tool details close_issue" })).toBeInTheDocument()
  expect(screen.queryByRole("region", { name: "tool details create_issue" })).not.toBeInTheDocument()
})

test("✕ closes; Esc closes only when nothing is armed (disarm has precedence)", async () => {
  render(<Harness />)
  await userEvent.click(screen.getByRole("button", { name: "details create_issue" }))
  const drawer = await screen.findByRole("region", { name: "tool details create_issue" })
  // arm a tool while the drawer is open
  await userEvent.click(screen.getByRole("button", { name: "tool close_issue" }))
  expect(screen.getByRole("button", { name: "Run close_issue" })).toBeInTheDocument()
  // first Esc disarms, drawer stays
  await userEvent.keyboard("{Escape}")
  expect(screen.queryByRole("button", { name: "Run close_issue" })).not.toBeInTheDocument()
  expect(screen.getByRole("region", { name: "tool details create_issue" })).toBeInTheDocument()
  // second Esc closes the drawer
  await userEvent.keyboard("{Escape}")
  await waitFor(() => expect(screen.queryByRole("region", { name: /tool details/i })).not.toBeInTheDocument())
  // reopen and close via ✕
  await userEvent.click(screen.getByRole("button", { name: "details create_issue" }))
  await screen.findByRole("region", { name: "tool details create_issue" })
  await userEvent.click(screen.getByRole("button", { name: /close details/i }))
  await waitFor(() => expect(screen.queryByRole("region", { name: /tool details/i })).not.toBeInTheDocument())
  void drawer
})

test("input-required tools state the run limitation honestly", async () => {
  const snapshot: ServerSnapshot = {
    ...conn.snapshot,
    tools: [
      {
        name: "needs_args",
        inputSchema: { type: "object", properties: { q: { type: "string" } }, required: ["q"] },
      },
    ],
  }
  render(<Harness snapshot={snapshot} transportKind="streamable-http" />)
  await userEvent.click(screen.getByRole("button", { name: "tool needs_args" }))
  const drawer = await screen.findByRole("region", { name: "tool details needs_args" })
  expect(within(drawer).getByText(/inputs required — running these is coming/i)).toBeInTheDocument()
  const titleRow = within(drawer).getByText("q").closest("tr")!
  expect(titleRow.textContent).toMatch(/✱/)
})

test("raw JSON stays behind its disclosure", async () => {
  render(<Harness initial={{ kind: "tool", id: "close_issue" }} />)
  const drawer = await screen.findByRole("region", { name: "tool details close_issue" })
  const summary = within(drawer).getByText(/raw json/i)
  await userEvent.click(summary)
  expect(within(drawer).getByText(/"name": "close_issue"/)).toBeInTheDocument()
})
