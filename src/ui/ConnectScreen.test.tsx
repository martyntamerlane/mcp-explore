import type { ReactElement } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { connectDemo } from "../mcp/connect"
import type { Connection } from "../mcp/types"
import ConnectScreen from "./ConnectScreen"
import { ModeProvider } from "./ModeContext"
import { loadRecents, saveRecent } from "./recents"

// The landing's mode toggle reads the app-level mode provider (App.tsx wraps
// both phases in it), so the harness supplies one.
const renderConnect = (el: ReactElement) => render(<ModeProvider>{el}</ModeProvider>)

beforeEach(() => localStorage.clear())

function demoBackedConnectUrl() {
  const calls: { url: string; headers: Record<string, string> }[] = []
  const fn = async (url: string, headers: Record<string, string> = {}): Promise<Connection> => {
    calls.push({ url, headers })
    return connectDemo()
  }
  return { fn, calls }
}

test("headers editor is hidden until disclosed, then submits entered headers", async () => {
  const { fn, calls } = demoBackedConnectUrl()
  const onConnected = vi.fn()
  renderConnect(<ConnectScreen onConnected={onConnected} connectUrlFn={fn} />)

  expect(screen.queryByLabelText(/header name/i)).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole("button", { name: /add headers/i }))
  await userEvent.type(screen.getByLabelText(/header name/i), "Authorization")
  await userEvent.type(screen.getByLabelText(/header value/i), "Bearer tok")
  await userEvent.type(screen.getByLabelText(/server url/i), "https://api.example/mcp")
  await userEvent.click(screen.getByRole("button", { name: /^connect$/i }))

  expect(await screen.findByLabelText(/server url/i)).toBeInTheDocument()
  expect(calls).toEqual([{ url: "https://api.example/mcp", headers: { Authorization: "Bearer tok" } }])
  expect(onConnected).toHaveBeenCalledOnce()
  expect(onConnected.mock.calls[0][1]).toEqual({ url: "https://api.example/mcp" })
})

test("successful connect records a recent; headers only when opted in", async () => {
  const { fn } = demoBackedConnectUrl()
  renderConnect(<ConnectScreen onConnected={vi.fn()} connectUrlFn={fn} />)
  await userEvent.type(screen.getByLabelText(/server url/i), "https://api.example/mcp")
  await userEvent.click(screen.getByRole("button", { name: /add headers/i }))
  await userEvent.type(screen.getByLabelText(/header name/i), "X-Key")
  await userEvent.type(screen.getByLabelText(/header value/i), "abc")
  // "remember headers" checkbox left UNCHECKED
  await userEvent.click(screen.getByRole("button", { name: /^connect$/i }))
  await vi.waitFor(() => expect(loadRecents()).toHaveLength(1))
  expect(loadRecents()[0].url).toBe("https://api.example/mcp")
  expect(loadRecents()[0].headers).toBeUndefined()
})

test("recent servers render and one click reconnects with stored headers", async () => {
  saveRecent({ url: "https://old.example/mcp", headers: { "X-Key": "k" } }, 1)
  const { fn, calls } = demoBackedConnectUrl()
  renderConnect(<ConnectScreen onConnected={vi.fn()} connectUrlFn={fn} />)
  await userEvent.click(screen.getByRole("button", { name: /old\.example/i }))
  await vi.waitFor(() => expect(calls).toHaveLength(1))
  expect(calls[0]).toEqual({ url: "https://old.example/mcp", headers: { "X-Key": "k" } })
})

test("demo button connects via connectDemoFn and reports no url source", async () => {
  const onConnected = vi.fn()
  renderConnect(<ConnectScreen onConnected={onConnected} connectDemoFn={connectDemo} />)
  await userEvent.click(screen.getByRole("button", { name: /explore the demo/i }))
  await vi.waitFor(() => expect(onConnected).toHaveBeenCalledOnce())
  expect(onConnected.mock.calls[0][1]).toEqual({})
})

test("failure renders the diagnostic panel with role=alert", async () => {
  const failing = async (): Promise<Connection> => {
    throw new Error("Unsupported scheme")
  }
  renderConnect(<ConnectScreen onConnected={vi.fn()} connectUrlFn={failing} />)
  await userEvent.type(screen.getByLabelText(/server url/i), "ftp://x")
  await userEvent.click(screen.getByRole("button", { name: /^connect$/i }))
  expect(await screen.findByRole("alert")).toHaveTextContent(/unsupported scheme/i)
})

test("autoConnect connects to initialUrl on mount", async () => {
  const { fn, calls } = demoBackedConnectUrl()
  const onConnected = vi.fn()
  renderConnect(<ConnectScreen onConnected={onConnected} initialUrl="https://auto.example/mcp" autoConnect connectUrlFn={fn} />)
  await vi.waitFor(() => expect(onConnected).toHaveBeenCalledOnce())
  expect(calls[0].url).toBe("https://auto.example/mcp")
})

test("recent buttons disable while a connect is in flight", async () => {
  saveRecent({ url: "https://old.example/mcp" }, 1)
  saveRecent({ url: "https://old2.example/mcp" }, 2)
  const neverResolves = () => new Promise<Connection>(() => {})
  renderConnect(<ConnectScreen onConnected={vi.fn()} connectUrlFn={neverResolves} />)
  await userEvent.click(screen.getByRole("button", { name: /old\.example/i }))
  expect(screen.getByRole("button", { name: /old\.example/i })).toBeDisabled()
  expect(screen.getByRole("button", { name: /old2\.example/i })).toBeDisabled()
})

test("reconnecting via a recent preserves its stored headers", async () => {
  saveRecent({ url: "https://old.example/mcp", headers: { "X-Key": "k" } }, 1)
  const { fn } = demoBackedConnectUrl()
  renderConnect(<ConnectScreen onConnected={vi.fn()} connectUrlFn={fn} />)
  await userEvent.click(screen.getByRole("button", { name: /old\.example/i }))
  await vi.waitFor(() => expect(loadRecents()[0].headers).toEqual({ "X-Key": "k" }))
})
