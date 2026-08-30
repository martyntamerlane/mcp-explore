import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { connectDemo } from "./mcp/connect"
import type { Connection } from "./mcp/types"
import { saveRecent } from "./ui/recents"
import App from "./App"

beforeEach(() => localStorage.clear())
afterEach(() => window.history.replaceState(null, "", "/"))

/**
 * A `#server=` link connects on arrival only for a server this device has used
 * before; an unknown one fills the box and waits for a click (ISSUE-12). The
 * deep-link tests below are about what a link's *selection* does once connected,
 * so they start from that established relationship rather than re-testing the
 * gate — which `ConnectScreen.test.tsx` covers directly.
 *
 * Selection moved from the query string to the fragment on 2026-08-30 (TODO-31),
 * so that opening a shared link stops handing the server's address to GitHub
 * Pages. These tests therefore address the app with `#`; the one `?` test below
 * is the back-compatibility guarantee for links shared before that.
 */
const alreadyUsed = (url: string) => saveRecent({ url }, 1)

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

test("#server= connects on arrival for a known server, and never carries headers", async () => {
  alreadyUsed("https://q.example/mcp")
  window.history.replaceState(null, "", "/#server=" + encodeURIComponent("https://q.example/mcp"))
  const calls: string[] = []
  const fake = async (url: string): Promise<Connection> => {
    calls.push(url)
    return connectDemo()
  }
  render(<App connectUrlFn={fake} />)
  expect(await screen.findByRole("region", { name: "Workspace" })).toBeInTheDocument()
  expect(calls).toEqual(["https://q.example/mcp"])
})

test("connecting by URL writes #server= to the address bar", async () => {
  const fake = async (): Promise<Connection> => connectDemo()
  render(<App connectUrlFn={fake} />)
  await userEvent.type(screen.getByLabelText(/server url/i), "https://w.example/mcp")
  await userEvent.click(screen.getByRole("button", { name: /^connect$/i }))
  await screen.findByRole("region", { name: "Workspace" })
  expect(window.location.hash).toBe("#server=" + encodeURIComponent("https://w.example/mcp"))
})

test("disconnecting after a #server= auto-connect does not reconnect", async () => {
  alreadyUsed("https://q.example/mcp")
  window.history.replaceState(null, "", "/#server=" + encodeURIComponent("https://q.example/mcp"))
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

test("connecting via the demo clears a stale #server= from the address bar", async () => {
  alreadyUsed("https://fails.example/mcp")
  window.history.replaceState(null, "", "/#server=" + encodeURIComponent("https://fails.example/mcp"))
  const failing = async (): Promise<Connection> => {
    throw new Error("boom")
  }
  render(<App connectUrlFn={failing} />)
  await screen.findByRole("alert")
  await userEvent.click(screen.getByRole("button", { name: /explore the demo/i }))
  expect(await screen.findByRole("region", { name: "Workspace" })).toBeInTheDocument()
  expect(window.location.hash).toBe("")
})

/**
 * The back-compatibility guarantee (TODO-31). Every `?server=` link shared before
 * selection moved to the fragment must keep working — including its selection —
 * and the address bar it lands on is rewritten to the form that no longer leaks.
 */
test("a ?server= link shared before the move still opens its subject", async () => {
  alreadyUsed("https://q.example/mcp")
  window.history.replaceState(
    null,
    "",
    "/?server=" + encodeURIComponent("https://q.example/mcp") + "&tool=create_issue",
  )
  const fake = async (): Promise<Connection> => connectDemo()
  render(<App connectUrlFn={fake} />)
  const workspace = await screen.findByRole("region", { name: "Workspace" })
  expect(within(workspace).getByRole("heading", { name: "create_issue" })).toBeInTheDocument()
  await waitFor(() =>
    expect(window.location.hash).toBe(
      "#server=" + encodeURIComponent("https://q.example/mcp") + "&tool=create_issue",
    ),
  )
  // The whole point: the query the browser would have sent is gone from the bar.
  expect(window.location.search).toBe("")
})

/* ── selection in the URL (interaction roadmap S1 / TODO-25) ── */

test("selecting a subject writes it to the address bar and Back walks it off", async () => {
  const fake = async (): Promise<Connection> => connectDemo()
  render(<App connectUrlFn={fake} />)
  await userEvent.type(screen.getByLabelText(/server url/i), "https://w.example/mcp")
  await userEvent.click(screen.getByRole("button", { name: /^connect$/i }))
  await screen.findByRole("region", { name: "Workspace" })

  await userEvent.click(screen.getByRole("button", { name: "tool create_issue" }))
  expect(window.location.hash).toBe(
    "#server=" + encodeURIComponent("https://w.example/mcp") + "&tool=create_issue",
  )

  window.history.back()
  await waitFor(() => expect(window.location.hash).toBe("#server=" + encodeURIComponent("https://w.example/mcp")))
  const workspace = screen.getByRole("region", { name: "Workspace" })
  await waitFor(() => expect(within(workspace).getByText(/simulated issue tracker/i)).toBeInTheDocument())
})

test("re-selecting the current subject adds no history entry", async () => {
  const fake = async (): Promise<Connection> => connectDemo()
  render(<App connectUrlFn={fake} />)
  await userEvent.type(screen.getByLabelText(/server url/i), "https://w.example/mcp")
  await userEvent.click(screen.getByRole("button", { name: /^connect$/i }))
  await screen.findByRole("region", { name: "Workspace" })

  const row = screen.getByRole("button", { name: "tool project_pulse" })
  await userEvent.click(row)
  await userEvent.click(row)
  const twiceSelected = window.location.hash
  window.history.back()
  // One entry back is the server without a selection, not the same tool twice.
  await waitFor(() => expect(window.location.hash).not.toBe(twiceSelected))
  expect(window.location.hash).toBe("#server=" + encodeURIComponent("https://w.example/mcp"))
})

test("a deep link opens its subject for someone who has never used the app", async () => {
  window.history.replaceState(
    null,
    "",
    "/#server=" + encodeURIComponent("https://q.example/mcp") + "&tool=create_issue",
  )
  const fake = async (): Promise<Connection> => connectDemo()
  render(<App connectUrlFn={fake} />)
  // A stranger's server waits for the press (ISSUE-12); the selection in the
  // link must survive that extra step rather than being spent by it.
  await userEvent.click(await screen.findByRole("button", { name: /^connect$/i }))
  const workspace = await screen.findByRole("region", { name: "Workspace" })
  expect(within(workspace).getByRole("heading", { name: "create_issue" })).toBeInTheDocument()
  const row = screen.getByRole("button", { name: "tool create_issue" })
  expect(row).toHaveAttribute("aria-current", "true")
  // The column mounts with the selection already made, and the keyboard
  // highlight must arrive with it — otherwise ↓ restarts from the top.
  await waitFor(() => expect(row).toHaveAttribute("data-active"))
  await userEvent.keyboard("{ArrowDown}")
  expect(screen.getByRole("button", { name: "tool list_issues" })).toHaveAttribute("data-active")
})

test("a resource deep link survives the percent-encoding of its URI", async () => {
  alreadyUsed("https://q.example/mcp")
  window.history.replaceState(
    null,
    "",
    "/#server=" + encodeURIComponent("https://q.example/mcp") + "&resource=" + encodeURIComponent("demo://config"),
  )
  const fake = async (): Promise<Connection> => connectDemo()
  render(<App connectUrlFn={fake} />)
  const workspace = await screen.findByRole("region", { name: "Workspace" })
  expect(await within(workspace).findByText("demo://config")).toBeInTheDocument()
})

test("a link to a subject this server does not expose opens the server, not an error", async () => {
  alreadyUsed("https://q.example/mcp")
  window.history.replaceState(
    null,
    "",
    "/#server=" + encodeURIComponent("https://q.example/mcp") + "&tool=no_such_tool",
  )
  const fake = async (): Promise<Connection> => connectDemo()
  render(<App connectUrlFn={fake} />)
  const workspace = await screen.findByRole("region", { name: "Workspace" })
  expect(within(workspace).getByText(/simulated issue tracker/i)).toBeInTheDocument()
  // The stale name is cleaned out rather than left to be re-shared.
  expect(window.location.hash).toBe("#server=" + encodeURIComponent("https://q.example/mcp"))
})

test("a selection is not inherited by a different server", async () => {
  alreadyUsed("https://fails.example/mcp")
  window.history.replaceState(
    null,
    "",
    "/#server=" + encodeURIComponent("https://fails.example/mcp") + "&tool=create_issue",
  )
  const failing = async (): Promise<Connection> => {
    throw new Error("boom")
  }
  render(<App connectUrlFn={failing} />)
  await screen.findByRole("alert")
  await userEvent.click(screen.getByRole("button", { name: /explore the demo/i }))
  const workspace = await screen.findByRole("region", { name: "Workspace" })
  expect(within(workspace).getByText(/simulated issue tracker/i)).toBeInTheDocument()
  expect(window.location.hash).toBe("")
})

test("a resource deep link opens the column on the list its subject lives in", async () => {
  alreadyUsed("https://q.example/mcp")
  window.history.replaceState(
    null,
    "",
    "/#server=" + encodeURIComponent("https://q.example/mcp") + "&resource=" + encodeURIComponent("demo://config"),
  )
  const fake = async (): Promise<Connection> => connectDemo()
  render(<App connectUrlFn={fake} />)
  await screen.findByRole("region", { name: "Workspace" })
  expect(screen.getByRole("button", { name: /^Resources/ })).toHaveAttribute("aria-pressed", "true")
  const row = screen.getByRole("button", { name: "resource config" })
  expect(row).toHaveAttribute("aria-current", "true")
  await waitFor(() => expect(row).toHaveAttribute("data-active"))
})

test("a deep link to a foldered resource unfolds the folders that hide its row", async () => {
  alreadyUsed("https://q.example/mcp")
  window.history.replaceState(
    null,
    "",
    "/#server=" +
      encodeURIComponent("https://q.example/mcp") +
      "&resource=" +
      encodeURIComponent("demo://docs/getting-started"),
  )
  const fake = async (): Promise<Connection> => connectDemo()
  render(<App connectUrlFn={fake} />)
  await screen.findByRole("region", { name: "Workspace" })
  expect(screen.getByRole("button", { name: "folder docs" })).toHaveAttribute("aria-expanded", "true")
  expect(screen.getByRole("button", { name: "resource getting-started" })).toHaveAttribute("aria-current", "true")
})
