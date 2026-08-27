import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { connectDemo } from "../../mcp/connect"
import type { Connection } from "../../mcp/types"
import { ReadProvider, readKey, useReads } from "./ReadContext"

let conn: Connection
beforeAll(async () => {
  conn = await connectDemo()
})
afterAll(async () => {
  await conn.close()
})

function Probe({ kind, id }: { kind: "resource" | "prompt"; id: string }) {
  const { reads, read } = useReads()
  const state = reads[readKey(kind, id)]
  return (
    <div>
      <button type="button" onClick={() => read(kind, id)}>
        go
      </button>
      <span data-testid="status">{state?.status ?? "idle"}</span>
      {state?.status === "done" && <span data-testid="ok">{String(state.display.ok)}</span>}
      {state?.status === "done" && (
        <pre data-testid="text">{state.display.blocks.map((b) => `${b.label ?? ""}${b.text ?? ""}`).join("\n")}</pre>
      )}
    </div>
  )
}

test("resource read transitions to done with formatted contents", async () => {
  render(
    <ReadProvider connection={conn}>
      <Probe kind="resource" id="demo://config" />
    </ReadProvider>,
  )
  expect(screen.getByTestId("status")).toHaveTextContent("idle")
  await userEvent.click(screen.getByRole("button", { name: "go" }))
  await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("done"))
  expect(screen.getByTestId("ok")).toHaveTextContent("true")
  expect(screen.getByTestId("text").textContent).toMatch(/defaultPriority/)
})

test("prompt read lands role-labelled message text", async () => {
  render(
    <ReadProvider connection={conn}>
      <Probe kind="prompt" id="weekly_summary" />
    </ReadProvider>,
  )
  await userEvent.click(screen.getByRole("button", { name: "go" }))
  await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("done"))
  expect(screen.getByTestId("text").textContent).toMatch(/^user/)
  expect(screen.getByTestId("text").textContent).toMatch(/three bullet points/)
})

test("a failing read lands done with ok=false, not a crash", async () => {
  render(
    <ReadProvider connection={conn}>
      <Probe kind="resource" id="demo://no-such-thing" />
    </ReadProvider>,
  )
  await userEvent.click(screen.getByRole("button", { name: "go" }))
  await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("done"))
  expect(screen.getByTestId("ok")).toHaveTextContent("false")
})

test("reads are cached — a second read of a done item is a no-op", async () => {
  const spy = vi.spyOn(conn.client, "readResource")
  render(
    <ReadProvider connection={conn}>
      <Probe kind="resource" id="demo://readme" />
    </ReadProvider>,
  )
  await userEvent.click(screen.getByRole("button", { name: "go" }))
  await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("done"))
  await userEvent.click(screen.getByRole("button", { name: "go" }))
  expect(screen.getByTestId("status")).toHaveTextContent("done")
  expect(spy).toHaveBeenCalledTimes(1)
  spy.mockRestore()
})

test("useReads outside a provider throws a clear error", () => {
  const spy = vi.spyOn(console, "error").mockImplementation(() => {})
  expect(() => render(<Probe kind="resource" id="x" />)).toThrow(/ReadProvider/)
  spy.mockRestore()
})
