import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { connectDemo } from "./mcp/connect"
import type { Connection } from "./mcp/types"
import App from "./App"

afterEach(() => window.history.replaceState(null, "", "/"))

test("full flow: demo → chrome band + workspace → tool subject → disconnect", async () => {
  render(<App />)
  await userEvent.click(screen.getByRole("button", { name: /explore the demo/i }))

  // One chrome band carries brand and server identity together — no second header.
  const bar = await screen.findByRole("banner")
  expect(within(bar).getByText("MCP EXPLORE")).toBeInTheDocument()
  expect(within(bar).getByRole("heading", { name: "demo-issue-tracker" })).toBeInTheDocument()
  expect(within(bar).getByText("v1.0.0")).toBeInTheDocument()
  expect(within(bar).getByText("in-memory")).toBeInTheDocument()
  expect(within(bar).getByLabelText(/filter items/i)).toBeInTheDocument()

  const workspace = screen.getByRole("region", { name: "Workspace" })
  expect(within(workspace).getByText(/simulated issue tracker/i)).toBeInTheDocument()

  await userEvent.click(screen.getByRole("button", { name: "tool create_issue" }))
  expect(within(workspace).getByText(/create a new issue/i)).toBeInTheDocument()

  await userEvent.click(within(bar).getByRole("button", { name: /disconnect/i }))
  expect(await screen.findByLabelText(/server url/i)).toBeInTheDocument()
})

test("the filter in the chrome band narrows the browse column", async () => {
  render(<App />)
  await userEvent.click(screen.getByRole("button", { name: /explore the demo/i }))
  await screen.findByRole("banner")
  await userEvent.type(screen.getByLabelText(/filter items/i), "pulse")
  expect(screen.getByRole("button", { name: "tool project_pulse" })).not.toHaveAttribute("data-receded")
  expect(screen.getByRole("button", { name: "tool create_issue" })).toHaveAttribute("data-receded")
})

test("?server= auto-connects via connectUrlFn and never carries headers", async () => {
  window.history.replaceState(null, "", "/?server=" + encodeURIComponent("https://q.example/mcp"))
  const calls: string[] = []
  const fake = async (url: string): Promise<Connection> => {
    calls.push(url)
    return connectDemo()
  }
  render(<App connectUrlFn={fake} />)
  expect(await screen.findByRole("region", { name: "Workspace" })).toBeInTheDocument()
  expect(calls).toEqual(["https://q.example/mcp"])
})

test("connecting by URL writes ?server= to the address bar", async () => {
  const fake = async (): Promise<Connection> => connectDemo()
  render(<App connectUrlFn={fake} />)
  await userEvent.type(screen.getByLabelText(/server url/i), "https://w.example/mcp")
  await userEvent.click(screen.getByRole("button", { name: /^connect$/i }))
  await screen.findByRole("region", { name: "Workspace" })
  expect(window.location.search).toBe("?server=" + encodeURIComponent("https://w.example/mcp"))
})

test("disconnecting after a ?server= auto-connect does not reconnect", async () => {
  window.history.replaceState(null, "", "/?server=" + encodeURIComponent("https://q.example/mcp"))
  const calls: string[] = []
  const fake = async (url: string): Promise<Connection> => {
    calls.push(url)
    return connectDemo()
  }
  render(<App connectUrlFn={fake} />)
  expect(await screen.findByRole("region", { name: "Workspace" })).toBeInTheDocument()
  await userEvent.click(screen.getByRole("button", { name: /disconnect/i }))
  expect(await screen.findByLabelText(/server url/i)).toBeInTheDocument()
  expect(calls).toEqual(["https://q.example/mcp"])
})

test("connecting via the demo clears a stale ?server= from the address bar", async () => {
  window.history.replaceState(null, "", "/?server=" + encodeURIComponent("https://fails.example/mcp"))
  const failing = async (): Promise<Connection> => {
    throw new Error("boom")
  }
  render(<App connectUrlFn={failing} />)
  await screen.findByRole("alert")
  await userEvent.click(screen.getByRole("button", { name: /explore the demo/i }))
  expect(await screen.findByRole("region", { name: "Workspace" })).toBeInTheDocument()
  expect(window.location.search).toBe("")
})
