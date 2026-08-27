import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { connectDemo } from "./mcp/connect"
import type { Connection } from "./mcp/types"
import App from "./App"

afterEach(() => window.history.replaceState(null, "", "/"))

test("full flow: demo → graph → node → panel → disconnect", async () => {
  render(<App />)
  await userEvent.click(screen.getByRole("button", { name: /try the demo/i }))
  expect(await screen.findByText(/TOOLS · 6/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole("button", { name: "tool create_issue" }))
  // The pill blurb also shows the description at rest, so scope panel assertions to the <aside>.
  const panel = await screen.findByRole("complementary")
  expect(within(panel).getByText(/create a new issue/i)).toBeInTheDocument()
  await userEvent.click(screen.getByRole("button", { name: /close details/i }))
  expect(screen.queryByRole("complementary")).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole("button", { name: /disconnect/i }))
  expect(await screen.findByLabelText(/server url/i)).toBeInTheDocument()
})

test("?server= auto-connects via connectUrlFn and never carries headers", async () => {
  window.history.replaceState(null, "", "/?server=" + encodeURIComponent("https://q.example/mcp"))
  const calls: string[] = []
  const fake = async (url: string): Promise<Connection> => {
    calls.push(url)
    return connectDemo()
  }
  render(<App connectUrlFn={fake} />)
  expect(await screen.findByText(/TOOLS · 6/)).toBeInTheDocument()
  expect(calls).toEqual(["https://q.example/mcp"])
})

test("connecting by URL writes ?server= to the address bar", async () => {
  const fake = async (): Promise<Connection> => connectDemo()
  render(<App connectUrlFn={fake} />)
  await userEvent.type(screen.getByLabelText(/server url/i), "https://w.example/mcp")
  await userEvent.click(screen.getByRole("button", { name: /^connect$/i }))
  await screen.findByText(/TOOLS · 6/)
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
  expect(await screen.findByText(/TOOLS · 6/)).toBeInTheDocument()
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
  await userEvent.click(screen.getByRole("button", { name: /try the demo/i }))
  expect(await screen.findByText(/TOOLS · 6/)).toBeInTheDocument()
  expect(window.location.search).toBe("")
})
