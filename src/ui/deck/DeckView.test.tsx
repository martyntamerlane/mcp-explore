import { useState } from "react"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { connectDemo } from "../../mcp/connect"
import type { Connection, ServerSnapshot, TransportKind } from "../../mcp/types"
import { ModeProvider } from "../ModeContext"
import { RawViewProvider } from "./rawView"
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
  onQuery: (q: string) => void
  onFocusFilter: () => void
  onCopyLink: () => void
  onDisconnect: () => void
}

function Harness({
  snapshot,
  transportKind,
  query,
  onSelect,
  onQuery,
  onFocusFilter,
  onCopyLink,
  onDisconnect,
}: HarnessProps) {
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
      onQuery={onQuery}
      onFocusFilter={onFocusFilter}
      onCopyLink={onCopyLink}
      onDisconnect={onDisconnect}
    />
  )
}

function renderDeck({ transportKind = "in-memory" as TransportKind, snapshot = conn.snapshot, query = "" } = {}) {
  const onSelect = vi.fn()
  const onQuery = vi.fn()
  const onFocusFilter = vi.fn()
  const onCopyLink = vi.fn()
  const onDisconnect = vi.fn()
  // Mode and raw-view are app-level providers in the real tree (App.tsx); the
  // stage reads both to build its command list (interaction roadmap S2).
  const tree = (props: Partial<HarnessProps>) => (
    <ModeProvider>
      <RunProvider connection={conn}>
        <ReadProvider connection={conn}>
          <RawViewProvider>
            <Harness
              snapshot={snapshot}
              transportKind={transportKind}
              query={query}
              onSelect={onSelect}
              onQuery={onQuery}
              onFocusFilter={onFocusFilter}
              onCopyLink={onCopyLink}
              onDisconnect={onDisconnect}
              {...props}
            />
          </RawViewProvider>
        </ReadProvider>
      </RunProvider>
    </ModeProvider>
  )
  const utils = render(tree({}))
  // Re-rendering the same Harness in place keeps its selection state, which is
  // how App behaves when only the filter or the snapshot changes.
  return {
    onSelect,
    onQuery,
    onFocusFilter,
    onCopyLink,
    onDisconnect,
    update: (props: Partial<HarnessProps>) => utils.rerender(tree(props)),
  }
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
  expect(spy).toHaveBeenCalledExactlyOnceWith({ name: "project_pulse", arguments: {} }, undefined, expect.anything())
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

  expect(spy).toHaveBeenCalledExactlyOnceWith(
    { name: "create_issue", arguments: { title: "Graph mis-renders" } },
    undefined,
    expect.anything(),
  )
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

test("a text/markdown resource renders as markdown, and the raw bytes stay one click away", async () => {
  renderDeck()
  await userEvent.click(screen.getByRole("button", { name: /^Resources/ }))
  await userEvent.click(screen.getByRole("button", { name: "resource readme" }))

  // The heading is a real heading, not a line beginning with a hash.
  expect(await within(workspace()).findByRole("heading", { name: "Demo issue tracker" })).toBeInTheDocument()
  expect(within(workspace()).queryByText(/^# Demo issue tracker/)).not.toBeInTheDocument()

  await userEvent.click(within(workspace()).getByRole("button", { name: "Show raw" }))
  expect(within(workspace()).getByText(/# Demo issue tracker/)).toBeInTheDocument()
  expect(within(workspace()).queryByRole("heading", { name: "Demo issue tracker" })).not.toBeInTheDocument()
})

test("a JSON result keeps its verbatim pre, with no markdown affordance", async () => {
  renderDeck()
  await userEvent.click(screen.getByRole("button", { name: "tool project_pulse" }))
  expect(await within(workspace()).findByText(/issue #104 opened/)).toBeInTheDocument()
  expect(within(workspace()).queryByRole("button", { name: "Show raw" })).not.toBeInTheDocument()
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

/* ── keyboard navigation (interaction roadmap S1) ── */

test("↓ highlights without selecting, and ⏎ is what commits", async () => {
  renderDeck()
  await userEvent.keyboard("{ArrowDown}")
  const first = screen.getByRole("button", { name: "tool create_issue" })
  expect(first).toHaveAttribute("data-active")
  // Highlighting is not selecting: the workspace is still home.
  expect(within(workspace()).getByText(/simulated issue tracker/i)).toBeInTheDocument()

  await userEvent.keyboard("{Enter}")
  expect(first).toHaveAttribute("aria-current", "true")
  expect(within(workspace()).getByText(/create a new issue/i)).toBeInTheDocument()
})

test("⏎ on a zero-argument tool runs it, exactly as a click does", async () => {
  const spy = vi.spyOn(conn.client, "callTool")
  renderDeck({ query: "pulse" })
  await userEvent.keyboard("{ArrowDown}{Enter}")
  expect(spy).toHaveBeenCalledExactlyOnceWith({ name: "project_pulse", arguments: {} }, undefined, expect.anything())
})

test("↑↓ clamp at the ends rather than wrapping", async () => {
  renderDeck()
  await userEvent.keyboard("{ArrowUp}")
  const last = screen.getByRole("button", { name: "tool generate_release_notes" })
  expect(last).toHaveAttribute("data-active")
  await userEvent.keyboard("{ArrowDown}")
  expect(last).toHaveAttribute("data-active")
})

test("the highlight skips rows the filter has receded", async () => {
  renderDeck({ query: "pulse" })
  // Only project_pulse matches, so one ↓ jumps the four rows above it.
  await userEvent.keyboard("{ArrowDown}")
  expect(screen.getByRole("button", { name: "tool project_pulse" })).toHaveAttribute("data-active")
  expect(screen.getByRole("button", { name: "tool create_issue" })).not.toHaveAttribute("data-active")
})

test("a click moves the highlight too, so ↓ continues from where you pointed", async () => {
  renderDeck()
  await userEvent.click(screen.getByRole("button", { name: "tool create_issue" }))
  await userEvent.keyboard("{ArrowDown}")
  expect(screen.getByRole("button", { name: "tool list_issues" })).toHaveAttribute("data-active")
})

test("→ and ← unfold and fold the highlighted folder", async () => {
  renderDeck()
  await userEvent.click(screen.getByRole("button", { name: /^Resources/ }))
  await userEvent.keyboard("{ArrowDown}")
  expect(screen.getByRole("button", { name: "folder docs" })).toHaveAttribute("data-active")

  await userEvent.keyboard("{ArrowRight}")
  expect(screen.getByRole("button", { name: "resource getting-started" })).toBeInTheDocument()
  await userEvent.keyboard("{ArrowLeft}")
  expect(screen.queryByRole("button", { name: "resource getting-started" })).not.toBeInTheDocument()
})

test("⏎ on a folder folds it, and the children join the key order once open", async () => {
  renderDeck()
  await userEvent.click(screen.getByRole("button", { name: /^Resources/ }))
  await userEvent.keyboard("{ArrowDown}{Enter}{ArrowDown}")
  expect(screen.getByRole("button", { name: "resource getting-started" })).toHaveAttribute("data-active")
})

test("switching segment drops the highlight rather than carrying it across", async () => {
  renderDeck()
  await userEvent.keyboard("{ArrowDown}")
  await userEvent.click(screen.getByRole("button", { name: /^Prompts/ }))
  expect(document.querySelector("[data-active]")).toBeNull()
})

test("/ asks for the filter; typing in a tool's own field does not", async () => {
  const { onFocusFilter } = renderDeck()
  await userEvent.keyboard("/")
  expect(onFocusFilter).toHaveBeenCalledOnce()

  await userEvent.click(screen.getByRole("button", { name: "tool create_issue" }))
  await userEvent.type(screen.getByLabelText(/^title/), "a/b")
  expect(onFocusFilter).toHaveBeenCalledOnce()
  expect(screen.getByLabelText(/^title/)).toHaveValue("a/b")
})

test("↑↓⏎ inside a tool's argument field belong to the field", async () => {
  const { onSelect } = renderDeck()
  await userEvent.click(screen.getByRole("button", { name: "tool create_issue" }))
  onSelect.mockClear()
  await userEvent.type(screen.getByLabelText(/^title/), "{ArrowDown}{ArrowUp}{Enter}")
  expect(onSelect).not.toHaveBeenCalled()
})

test("Escape clears the filter first and only then returns home", async () => {
  const { onQuery, update } = renderDeck({ query: "issue" })
  await userEvent.click(screen.getByRole("button", { name: "tool create_issue" }))
  await userEvent.keyboard("{Escape}")
  expect(onQuery).toHaveBeenCalledWith("")
  // The subject survived that Escape; the filter took it.
  expect(within(workspace()).getByText(/create a new issue/i)).toBeInTheDocument()

  update({ query: "" })
  await userEvent.keyboard("{Escape}")
  expect(within(workspace()).getByText(/simulated issue tracker/i)).toBeInTheDocument()
})

/* ── the run record (interaction roadmap S3) ── */

test("running a tool twice keeps both answers, each labelled by its arguments", async () => {
  renderDeck()
  await userEvent.click(screen.getByRole("button", { name: "tool search_issues" }))
  const field = screen.getByLabelText(/^query/)

  await userEvent.type(field, "graph")
  await userEvent.click(screen.getByRole("button", { name: /run search_issues/i }))
  expect(await within(workspace()).findByText(/1 issue matched/)).toBeInTheDocument()

  await userEvent.clear(field)
  await userEvent.type(field, "issue")
  await userEvent.click(screen.getByRole("button", { name: /run search_issues/i }))
  expect(await within(workspace()).findByText(/0 issues matched/)).toBeInTheDocument()

  // The earlier answer is still reachable, named by the arguments that made it.
  const runs = within(workspace()).getAllByRole("button", { name: /query: / })
  expect(runs).toHaveLength(2)
  expect(runs[0]).toHaveTextContent("query: issue")
  expect(runs[1]).toHaveTextContent("query: graph")

  await userEvent.click(runs[1])
  expect(within(workspace()).getByText(/1 issue matched/)).toBeInTheDocument()
  expect(within(workspace()).queryByText(/0 issues matched/)).not.toBeInTheDocument()
})

test("restoring a past run refills the form that produced it", async () => {
  renderDeck()
  await userEvent.click(screen.getByRole("button", { name: "tool search_issues" }))
  const field = screen.getByLabelText(/^query/)

  await userEvent.type(field, "graph")
  await userEvent.click(screen.getByRole("button", { name: /run search_issues/i }))
  await within(workspace()).findByText(/1 issue matched/)
  await userEvent.clear(field)
  await userEvent.type(field, "issue")
  await userEvent.click(screen.getByRole("button", { name: /run search_issues/i }))
  await within(workspace()).findByText(/0 issues matched/)

  expect(screen.getByLabelText(/^query/)).toHaveValue("issue")
  await userEvent.click(within(workspace()).getByRole("button", { name: /query: graph/ }))
  expect(screen.getByLabelText(/^query/)).toHaveValue("graph")
})

test("a single run shows no history list — a list of one is noise", async () => {
  renderDeck()
  await userEvent.click(screen.getByRole("button", { name: "tool project_pulse" }))
  await within(workspace()).findByText(/mcp-explore demo/)
  expect(within(workspace()).queryByText("RUNS")).not.toBeInTheDocument()
})

test("a failed run joins the history beside the successes", async () => {
  const spy = vi.spyOn(conn.client, "callTool")
  renderDeck()
  await userEvent.click(screen.getByRole("button", { name: "tool project_pulse" }))
  await within(workspace()).findByText(/mcp-explore demo/)

  spy.mockRejectedValueOnce(new Error("transport went away"))
  await userEvent.click(screen.getByRole("button", { name: /run again/i }))
  expect(await within(workspace()).findByText(/transport went away/)).toBeInTheDocument()

  const runs = within(workspace()).getAllByRole("button", { name: /no arguments/ })
  expect(runs).toHaveLength(2)
  expect(runs[0]).toHaveTextContent("failed")
  await userEvent.click(runs[1])
  expect(within(workspace()).getByText(/mcp-explore demo/)).toBeInTheDocument()
})

test("a run in flight reports elapsed time rather than a static Running…", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  try {
    let release: (() => void) | undefined
    vi.spyOn(conn.client, "callTool").mockReturnValueOnce(
      new Promise((resolve) => {
        release = () => resolve({ content: [{ type: "text", text: "done at last" }] })
      }) as ReturnType<typeof conn.client.callTool>,
    )
    renderDeck()
    await userEvent.click(screen.getByRole("button", { name: "tool project_pulse" }))
    expect(within(workspace()).getByText(/Running…/, { selector: "p" })).toHaveTextContent("0.0s")

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500)
    })
    expect(within(workspace()).getByText(/Running…/, { selector: "p" })).toHaveTextContent("2.5s")

    await act(async () => {
      release?.()
    })
    expect(await within(workspace()).findByText(/done at last/)).toBeInTheDocument()
  } finally {
    vi.useRealTimers()
  }
})

/* ── command mode (interaction roadmap S2) ── */

test("`>` turns the column into the command list without anything arriving", async () => {
  const { update } = renderDeck()
  expect(screen.getByRole("button", { name: "tool create_issue" })).toBeInTheDocument()

  update({ query: ">" })
  // The entities are gone from the column, the commands are in their place, and
  // the segmented control is still standing where it was.
  expect(screen.queryByRole("button", { name: "tool create_issue" })).not.toBeInTheDocument()
  expect(screen.getByRole("listbox", { name: "Commands" })).toBeInTheDocument()
  expect(screen.getByRole("group", { name: "Kind" })).toBeInTheDocument()
  expect(screen.getByRole("option", { name: /disconnect/i })).toBeInTheDocument()
})

test("the command list narrows as you type, and the best match is already highlighted", async () => {
  const { update } = renderDeck()
  update({ query: ">dis" })
  const options = screen.getAllByRole("option")
  expect(options).toHaveLength(1)
  expect(options[0]).toHaveTextContent("Disconnect")
  // Reached by typing, so ⏎ works without a preparatory ↓.
  expect(options[0]).toHaveAttribute("aria-selected", "true")
})

test("⏎ runs the highlighted command; ↓ moves the highlight first", async () => {
  const { update, onDisconnect } = renderDeck()
  update({ query: ">" })
  // Nothing is selected, so the list opens on Switch to … mode, then Disconnect.
  await userEvent.keyboard("{ArrowDown}")
  expect(screen.getByRole("option", { name: /disconnect/i })).toHaveAttribute("aria-selected", "true")
  await userEvent.keyboard("{Enter}")
  expect(onDisconnect).toHaveBeenCalled()
})

test("running a command clears the filter, so the column goes back to browsing", async () => {
  const { update, onQuery, onSelect } = renderDeck()
  await userEvent.click(screen.getByRole("button", { name: "tool create_issue" }))
  update({ query: ">home" })
  await userEvent.click(screen.getByRole("option", { name: /home/i }))
  expect(onSelect).toHaveBeenLastCalledWith(null)
  expect(onQuery).toHaveBeenLastCalledWith("")
})

test("copy link confirms in its own row rather than vanishing silently", async () => {
  const writeText = vi.fn()
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } })
  const { update, onCopyLink } = renderDeck()
  await userEvent.click(screen.getByRole("button", { name: "tool create_issue" }))
  update({ query: ">copy" })
  await userEvent.click(screen.getByRole("option", { name: /copy link/i }))
  expect(onCopyLink).toHaveBeenCalled()
  // The row says so; the filter is not cleared out from under the confirmation.
  expect(screen.getByRole("option", { name: /link copied/i })).toBeInTheDocument()
  vi.unstubAllGlobals()
})

test("home and copy link are absent when there is no selection to act on", async () => {
  const { update } = renderDeck()
  update({ query: ">" })
  expect(screen.queryByRole("option", { name: /^home/i })).not.toBeInTheDocument()
  expect(screen.queryByRole("option", { name: /copy link/i })).not.toBeInTheDocument()
})

test("Escape leaves command mode by clearing the filter, not by going home", async () => {
  const { update, onQuery, onSelect } = renderDeck()
  await userEvent.click(screen.getByRole("button", { name: "tool create_issue" }))
  onSelect.mockClear()
  update({ query: ">" })
  await userEvent.keyboard("{Escape}")
  expect(onQuery).toHaveBeenLastCalledWith("")
  expect(onSelect).not.toHaveBeenCalled()
})

test("show raw is offered only once something on screen is rendered markdown", async () => {
  const { update } = renderDeck()
  update({ query: ">" })
  expect(screen.queryByRole("option", { name: /show raw/i })).not.toBeInTheDocument()

  update({ query: "" })
  await userEvent.click(screen.getByRole("button", { name: /^Resources/ }))
  await userEvent.click(screen.getByRole("button", { name: "resource readme" }))
  await within(workspace()).findByRole("button", { name: "Show raw" })
  update({ query: ">" })
  expect(screen.getByRole("option", { name: /show raw/i })).toBeInTheDocument()
})
