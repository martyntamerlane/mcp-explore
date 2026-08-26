import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, test, vi } from "vitest"
import type { ServerSnapshot } from "../../mcp/types"
import FlowView from "./FlowView"

const snap = (over: Partial<ServerSnapshot> = {}): ServerSnapshot => ({
  serverInfo: { name: "demo-server", version: "2.0" },
  capabilities: {},
  tools: [
    { name: "create_issue", description: "Create a new issue.", inputSchema: { type: "object" } },
    { name: "close_issue", description: "Close an issue.", inputSchema: { type: "object" } },
  ],
  resources: [],
  prompts: [{ name: "triage", description: "Draft a triage." }],
  ...over,
})

const noop = () => {}

test("renders server node, cluster headers with counts, and glosses", () => {
  render(<FlowView snapshot={snap()} transportKind="streamable-http" selection={null} onSelect={noop} />)
  expect(screen.getByText("demo-server")).toBeInTheDocument()
  expect(screen.getByText("streamable-http")).toBeInTheDocument()
  expect(screen.getByText("TOOLS · 2")).toBeInTheDocument()
  expect(screen.getByText("RESOURCES · 0")).toBeInTheDocument()
  expect(screen.getByText("PROMPTS · 1")).toBeInTheDocument()
  expect(screen.getByText("actions it can perform")).toBeInTheDocument()
  expect(screen.getByText("data it exposes")).toBeInTheDocument()
  expect(screen.getByText("ready-made instructions")).toBeInTheDocument()
})

test("wide clusters show blurbs inside pills; compact clusters do not", () => {
  render(<FlowView snapshot={snap()} transportKind="sse" selection={null} onSelect={noop} />)
  expect(
    within(screen.getByRole("button", { name: "tool create_issue" })).getByText("Create a new issue."),
  ).toBeInTheDocument()

  const many = Array.from({ length: 12 }, (_, i) => ({
    name: `t${i}`,
    description: `Description ${i}.`,
    inputSchema: { type: "object" as const },
  }))
  render(<FlowView snapshot={snap({ tools: many })} transportKind="sse" selection={null} onSelect={noop} />)
  const pill = screen.getByRole("button", { name: "tool t3" })
  expect(within(pill).queryByText("Description 3.")).not.toBeInTheDocument()
})

test("clicking a pill selects; selected pill is aria-pressed", () => {
  const onSelect = vi.fn()
  const { rerender } = render(<FlowView snapshot={snap()} transportKind="sse" selection={null} onSelect={onSelect} />)
  const pill = screen.getByRole("button", { name: "tool create_issue" })
  pill.click()
  expect(onSelect).toHaveBeenCalledWith({ kind: "tool", id: "create_issue" })
  rerender(
    <FlowView
      snapshot={snap()}
      transportKind="sse"
      selection={{ kind: "tool", id: "create_issue" }}
      onSelect={onSelect}
    />,
  )
  expect(screen.getByRole("button", { name: "tool create_issue" })).toHaveAttribute("aria-pressed", "true")
})

test("hovering a pill prints label and full blurb in the readout; idle shows hint", async () => {
  const user = userEvent.setup()
  render(<FlowView snapshot={snap()} transportKind="sse" selection={null} onSelect={noop} />)
  const readout = screen.getByTestId("readout")
  expect(readout).toHaveTextContent("hover an item")
  await user.hover(screen.getByRole("button", { name: "prompt triage" }))
  expect(readout).toHaveTextContent("triage — Draft a triage.")
  await user.unhover(screen.getByRole("button", { name: "prompt triage" }))
  expect(readout).toHaveTextContent("hover an item")
})

test("filter recedes non-matching pills, keeps matches, and never hides anything", async () => {
  const user = userEvent.setup()
  render(<FlowView snapshot={snap()} transportKind="sse" selection={null} onSelect={noop} />)
  await user.type(screen.getByLabelText(/filter/i), "close")
  expect(screen.getByRole("button", { name: "tool close_issue" })).not.toHaveAttribute("data-receded")
  expect(screen.getByRole("button", { name: "tool create_issue" })).toHaveAttribute("data-receded", "true")
  expect(screen.getByRole("button", { name: "prompt triage" })).toHaveAttribute("data-receded", "true")
})

test("large clusters preview 14 pills with a show-all expander", async () => {
  const user = userEvent.setup()
  const many = Array.from({ length: 20 }, (_, i) => ({
    name: `tool_${i}`,
    inputSchema: { type: "object" as const },
  }))
  render(<FlowView snapshot={snap({ tools: many })} transportKind="sse" selection={null} onSelect={noop} />)
  expect(screen.getByRole("button", { name: "tool tool_13" })).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "tool tool_14" })).not.toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Show all 20 Tools" }))
  expect(screen.getByRole("button", { name: "tool tool_19" })).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Show fewer Tools" }))
  expect(screen.queryByRole("button", { name: "tool tool_19" })).not.toBeInTheDocument()
})

test("an active filter searches past the preview cap", async () => {
  const user = userEvent.setup()
  const many = Array.from({ length: 20 }, (_, i) => ({
    name: `tool_${i}`,
    inputSchema: { type: "object" as const },
  }))
  render(<FlowView snapshot={snap({ tools: many })} transportKind="sse" selection={null} onSelect={noop} />)
  await user.type(screen.getByLabelText(/filter/i), "tool_19")
  expect(screen.getByRole("button", { name: "tool tool_19" })).not.toHaveAttribute("data-receded")
  expect(screen.getByRole("button", { name: "tool tool_0" })).toHaveAttribute("data-receded", "true")
})

test("cluster collapse hides its pills and flips the toggle label", async () => {
  const user = userEvent.setup()
  render(<FlowView snapshot={snap()} transportKind="sse" selection={null} onSelect={noop} />)
  await user.click(screen.getByRole("button", { name: "Collapse Tools" }))
  expect(screen.queryByRole("button", { name: "tool create_issue" })).not.toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Expand Tools" }))
  expect(screen.getByRole("button", { name: "tool create_issue" })).toBeInTheDocument()
})
