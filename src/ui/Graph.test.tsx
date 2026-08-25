import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { computeLayout } from "./layout"
import Graph from "./Graph"

const layout = computeLayout({
  tools: [{ name: "create_issue" }, { name: "list_issues" }],
  resources: [{ uri: "demo://config" }],
  prompts: [{ name: "weekly_summary" }],
})

test("renders server, hub labels with counts, and one accessible node per leaf", () => {
  render(<Graph layout={layout} serverName="demo-issue-tracker" selected={null} onSelect={vi.fn()} />)
  expect(screen.getByText("demo-issue-tracker")).toBeInTheDocument()
  expect(screen.getByText(/TOOLS · 2/)).toBeInTheDocument()
  expect(screen.getByText(/RESOURCES · 1/)).toBeInTheDocument()
  expect(screen.getByText(/PROMPTS · 1/)).toBeInTheDocument()
  expect(screen.getAllByRole("button", { name: /^(tool|resource|prompt) / })).toHaveLength(4)
})

test("clicking a node selects it; clicking the background clears", async () => {
  const onSelect = vi.fn()
  render(<Graph layout={layout} serverName="s" selected={null} onSelect={onSelect} />)
  await userEvent.click(screen.getByRole("button", { name: "tool create_issue" }))
  expect(onSelect).toHaveBeenLastCalledWith({ kind: "tool", id: "create_issue" })
})

test("keyboard: Enter on a focused node selects it", async () => {
  const onSelect = vi.fn()
  render(<Graph layout={layout} serverName="s" selected={null} onSelect={onSelect} />)
  screen.getByRole("button", { name: "resource demo://config" }).focus()
  await userEvent.keyboard("{Enter}")
  expect(onSelect).toHaveBeenLastCalledWith({ kind: "resource", id: "demo://config" })
})

test("search dims non-matching leaves only", async () => {
  render(<Graph layout={layout} serverName="s" selected={null} onSelect={vi.fn()} />)
  await userEvent.type(screen.getByLabelText(/filter nodes/i), "create")
  const match = screen.getByRole("button", { name: "tool create_issue" })
  const miss = screen.getByRole("button", { name: "prompt weekly_summary" })
  expect(match.getAttribute("class") ?? "").not.toMatch(/dimmed/)
  expect(miss.getAttribute("class") ?? "").toMatch(/dimmed/)
})
