import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ComponentProps } from "react"
import { connectDemo } from "../mcp/connect"
import type { Connection } from "../mcp/types"
import { RunProvider, useRuns } from "./run/RunContext"
import DetailPanel from "./DetailPanel"

let conn: Connection
beforeAll(async () => {
  conn = await connectDemo()
})
afterAll(async () => {
  await conn.close()
})

// The panel reads per-tool run state, so every render needs the provider.
function renderPanel(props: Omit<ComponentProps<typeof DetailPanel>, "connection"> & { connection?: Connection }) {
  const connection = props.connection ?? conn
  return render(
    <RunProvider connection={connection}>
      <DetailPanel {...props} connection={connection} />
    </RunProvider>,
  )
}

function RunTrigger({ tool }: { tool: string }) {
  const { run } = useRuns()
  return (
    <button type="button" onClick={() => run(tool)}>
      trigger
    </button>
  )
}

test("renders nothing when no selection", () => {
  const { container } = render(
    <RunProvider connection={conn}>
      <DetailPanel connection={conn} selected={null} onClose={vi.fn()} />
    </RunProvider>,
  )
  expect(container).toBeEmptyDOMElement()
})

test("tool: a run's result lands in the panel", async () => {
  render(
    <RunProvider connection={conn}>
      <RunTrigger tool="project_pulse" />
      <DetailPanel connection={conn} selected={{ kind: "tool", id: "project_pulse" }} onClose={vi.fn()} />
    </RunProvider>,
  )
  await userEvent.click(screen.getByRole("button", { name: "trigger" }))
  // the sparkline exists only in the run output, never in the tool description
  expect(await screen.findByText(/▂▄▃▆▅█▇/)).toBeInTheDocument()
})

test("tool: a failed run gets an honest error treatment", async () => {
  vi.spyOn(conn.client, "callTool").mockRejectedValueOnce(new Error("server exploded"))
  render(
    <RunProvider connection={conn}>
      <RunTrigger tool="project_pulse" />
      <DetailPanel connection={conn} selected={{ kind: "tool", id: "project_pulse" }} onClose={vi.fn()} />
    </RunProvider>,
  )
  await userEvent.click(screen.getByRole("button", { name: "trigger" }))
  const alert = await screen.findByRole("alert")
  expect(alert.textContent).toMatch(/server exploded/)
  vi.restoreAllMocks()
})

test("tool: input-required tools state the run limitation honestly", () => {
  const fixture: Connection = {
    ...conn,
    transportKind: "streamable-http",
    snapshot: {
      ...conn.snapshot,
      tools: [
        {
          name: "needs_args",
          inputSchema: { type: "object", properties: { q: { type: "string" } }, required: ["q"] },
        },
      ],
    },
  }
  renderPanel({ connection: fixture, selected: { kind: "tool", id: "needs_args" }, onClose: vi.fn() })
  expect(screen.getByText(/inputs required — running these is coming/i)).toBeInTheDocument()
})

test("tool: arguments table with required marker and enum chips", () => {
  // Demo tools are deliberately zero-required (redesign spec §5), so the
  // required marker needs a synthetic snapshot.
  const fixture: Connection = {
    ...conn,
    snapshot: {
      ...conn.snapshot,
      tools: [
        {
          name: "create_widget",
          description: "Create a new widget.",
          inputSchema: {
            type: "object",
            properties: {
              title: { type: "string", description: "Widget title" },
              priority: { type: "string", enum: ["low", "medium", "high"] },
            },
            required: ["title"],
          },
        },
      ],
    },
  }
  renderPanel({ connection: fixture, selected: { kind: "tool", id: "create_widget" }, onClose: vi.fn() })
  expect(screen.getByText("create_widget")).toBeInTheDocument()
  expect(screen.getByText(/create a new widget/i)).toBeInTheDocument()
  const titleRow = screen.getByText("title").closest("tr")!
  expect(titleRow.textContent).toMatch(/✱/)
  expect(screen.getByText("low")).toBeInTheDocument()
  expect(screen.getByText("high")).toBeInTheDocument()
})

test("the panel is tools-only — resource and prompt selections render nothing", () => {
  const { container } = renderPanel({ selected: { kind: "resource", id: "demo://readme" }, onClose: vi.fn() })
  expect(container).toBeEmptyDOMElement()
  const prompt = renderPanel({ selected: { kind: "prompt", id: "weekly_summary" }, onClose: vi.fn() })
  expect(prompt.container).toBeEmptyDOMElement()
})

test("raw JSON is behind a disclosure", async () => {
  renderPanel({ selected: { kind: "tool", id: "close_issue" }, onClose: vi.fn() })
  const summary = screen.getByText(/raw json/i)
  expect(summary).toBeInTheDocument()
  await userEvent.click(summary)
  expect(screen.getByText(/"name": "close_issue"/)).toBeInTheDocument()
})

test("close button fires onClose", async () => {
  const onClose = vi.fn()
  renderPanel({ selected: { kind: "tool", id: "close_issue" }, onClose })
  await userEvent.click(screen.getByRole("button", { name: /close details/i }))
  expect(onClose).toHaveBeenCalledOnce()
})
