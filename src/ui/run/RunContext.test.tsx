import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { connectDemo } from "../../mcp/connect"
import type { Connection } from "../../mcp/types"
import { RunProvider, useRuns } from "./RunContext"

let conn: Connection
beforeAll(async () => {
  conn = await connectDemo()
})
afterAll(async () => {
  await conn.close()
})

function Probe({ tool }: { tool: string }) {
  const { runs, run } = useRuns()
  const state = runs[tool] ?? { status: "idle" }
  return (
    <div>
      <button type="button" onClick={() => run(tool)}>
        go
      </button>
      <span data-testid="status">{state.status}</span>
      {state.status === "done" && <span data-testid="ok">{String(state.display.ok)}</span>}
      {state.status === "done" && <pre data-testid="text">{state.display.blocks.map((b) => b.text).join("\n")}</pre>}
    </div>
  )
}

test("run transitions idle → running → done with formatted output", async () => {
  render(
    <RunProvider connection={conn}>
      <Probe tool="project_pulse" />
    </RunProvider>,
  )
  expect(screen.getByTestId("status")).toHaveTextContent("idle")
  await userEvent.click(screen.getByRole("button", { name: "go" }))
  await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("done"))
  expect(screen.getByTestId("ok")).toHaveTextContent("true")
  expect(screen.getByTestId("text").textContent).toMatch(/velocity/)
})

test("a failing call lands done with ok=false, not a crash", async () => {
  render(
    <RunProvider connection={conn}>
      <Probe tool="no_such_tool" />
    </RunProvider>,
  )
  await userEvent.click(screen.getByRole("button", { name: "go" }))
  await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("done"))
  expect(screen.getByTestId("ok")).toHaveTextContent("false")
})

test("useRuns outside a provider throws a clear error", () => {
  const spy = vi.spyOn(console, "error").mockImplementation(() => {})
  expect(() => render(<Probe tool="x" />)).toThrow(/RunProvider/)
  spy.mockRestore()
})
