import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { connectDemo } from "../mcp/connect"
import type { Connection } from "../mcp/types"
import DetailPanel from "./DetailPanel"

let conn: Connection
beforeAll(async () => {
  conn = await connectDemo()
})
afterAll(async () => {
  await conn.close()
})

test("renders nothing when no selection", () => {
  const { container } = render(<DetailPanel connection={conn} selected={null} onClose={vi.fn()} />)
  expect(container).toBeEmptyDOMElement()
})

test("tool: arguments table with required marker and enum chips", () => {
  render(<DetailPanel connection={conn} selected={{ kind: "tool", id: "create_issue" }} onClose={vi.fn()} />)
  expect(screen.getByText("create_issue")).toBeInTheDocument()
  expect(screen.getByText(/create a new issue/i)).toBeInTheDocument()
  const titleRow = screen.getByText("title").closest("tr")!
  expect(titleRow.textContent).toMatch(/✱/)
  expect(screen.getByText("low")).toBeInTheDocument()
  expect(screen.getByText("high")).toBeInTheDocument()
})

test("resource: contents load on demand and render as text", async () => {
  render(<DetailPanel connection={conn} selected={{ kind: "resource", id: "demo://readme" }} onClose={vi.fn()} />)
  expect(screen.getByText("demo://readme")).toBeInTheDocument()
  expect(screen.queryByText(/entirely inside your browser/i)).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole("button", { name: /load contents/i }))
  expect(await screen.findByText(/entirely inside your browser/i)).toBeInTheDocument()
})

test("raw JSON is behind a disclosure", async () => {
  render(<DetailPanel connection={conn} selected={{ kind: "prompt", id: "weekly_summary" }} onClose={vi.fn()} />)
  const summary = screen.getByText(/raw json/i)
  expect(summary).toBeInTheDocument()
  await userEvent.click(summary)
  expect(screen.getByText(/"name": "weekly_summary"/)).toBeInTheDocument()
})

test("close button fires onClose", async () => {
  const onClose = vi.fn()
  render(<DetailPanel connection={conn} selected={{ kind: "tool", id: "close_issue" }} onClose={onClose} />)
  await userEvent.click(screen.getByRole("button", { name: /close details/i }))
  expect(onClose).toHaveBeenCalledOnce()
})
