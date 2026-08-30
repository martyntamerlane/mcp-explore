import type { ReactElement } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ConnectFailure, connectDemo } from "../mcp/connect"
import type { Connection } from "../mcp/types"
import ConnectScreen from "./ConnectScreen"
import { EXAMPLE_SERVERS } from "./examples"
import { ModeProvider } from "./ModeContext"
import { loadRecents, saveRecent } from "./recents"
import { TAGLINES } from "./taglines"

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

test("autoConnect reuses headers remembered for that same server", async () => {
  // A `?server=` link is the same server the visitor may have saved headers
  // for; connecting anonymously made every shared link fail on an auth'd
  // server that works from the recents list (TODO-12).
  saveRecent({ url: "https://auto.example/mcp", headers: { Authorization: "Bearer saved" } }, 1)
  const { fn, calls } = demoBackedConnectUrl()
  renderConnect(
    <ConnectScreen onConnected={vi.fn()} initialUrl="https://auto.example/mcp" autoConnect connectUrlFn={fn} />,
  )
  await vi.waitFor(() => expect(calls).toHaveLength(1))
  expect(calls[0].headers).toEqual({ Authorization: "Bearer saved" })
  // And they survive the round trip rather than being dropped on re-save.
  await vi.waitFor(() => expect(loadRecents()[0].headers).toEqual({ Authorization: "Bearer saved" }))
})

test("autoConnect for a different server does not borrow another's headers", async () => {
  saveRecent({ url: "https://other.example/mcp", headers: { Authorization: "Bearer saved" } }, 1)
  const { fn, calls } = demoBackedConnectUrl()
  renderConnect(
    <ConnectScreen onConnected={vi.fn()} initialUrl="https://auto.example/mcp" autoConnect connectUrlFn={fn} />,
  )
  await vi.waitFor(() => expect(calls).toHaveLength(1))
  expect(calls[0].headers).toEqual({})
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

test("the hero line is one of the taglines, and holds still across re-renders", () => {
  const { rerender } = renderConnect(<ConnectScreen onConnected={vi.fn()} />)
  const first = screen.getByRole("heading", { level: 1 }).textContent
  expect(TAGLINES).toContain(first)
  rerender(<ModeProvider><ConnectScreen onConnected={vi.fn()} /></ModeProvider>)
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(first!)
})

const sdkError = (code: number, message: string) => Object.assign(new Error(message), { code })
const failingWith = (...errors: unknown[]) => async (): Promise<Connection> => {
  throw new ConnectFailure(
    errors.map((error, i) => ({
      kind: i === 0 ? ("streamable-http" as const) : ("sse" as const),
      phase: "connect" as const,
      error,
    })),
  )
}

async function connectAndFail(props: Partial<Parameters<typeof ConnectScreen>[0]>) {
  renderConnect(<ConnectScreen onConnected={vi.fn()} probeFn={async () => "silent"} {...props} />)
  await userEvent.type(screen.getByLabelText(/server url/i), "https://api.example/mcp")
  await userEvent.click(screen.getByRole("button", { name: /^connect$/i }))
  return screen.findByRole("alert")
}

test("a 401 is reported as credentials, not as a CORS problem", async () => {
  const alert = await connectAndFail({ connectUrlFn: failingWith(sdkError(401, "unauthorized")) })
  expect(alert).toHaveTextContent(/requires credentials/i)
  expect(alert).not.toHaveTextContent(/Access-Control-Allow-Origin/)
})

test("the 401 action opens the headers box with an Authorization row seeded", async () => {
  await connectAndFail({ connectUrlFn: failingWith(sdkError(401, "unauthorized")) })
  expect(screen.queryByLabelText(/header name/i)).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole("button", { name: /add an authorization header/i }))
  expect(await screen.findByLabelText(/header name 1/i)).toHaveValue("Authorization")
  expect(screen.getByLabelText(/header value 1/i)).toHaveValue("Bearer ")
})

test("a 404 says the host was reached rather than lecturing about CORS", async () => {
  const alert = await connectAndFail({ connectUrlFn: failingWith(sdkError(404, "not found")) })
  expect(alert).toHaveTextContent(/nothing MCP at this path/i)
  expect(alert).not.toHaveTextContent(/Access-Control-Allow-Origin/)
})

test("a probe that answers turns the opaque failure into a stated CORS verdict", async () => {
  const alert = await connectAndFail({
    connectUrlFn: failingWith(new TypeError("Failed to fetch"), new TypeError("Failed to fetch")),
    probeFn: async () => "answered",
  })
  await vi.waitFor(() => expect(alert).toHaveTextContent(/doesn't allow browsers to read its responses/i))
  expect(alert).toHaveTextContent(/Access-Control-Expose-Headers: Mcp-Session-Id/)
  // The handshake command must never carry a real token (spec §6).
  expect(alert).toHaveTextContent(/curl -i -X POST/)
  expect(alert).not.toHaveTextContent(/Bearer [^Y]/)
})

test("a probe that stays silent never mentions CORS at all", async () => {
  const alert = await connectAndFail({
    connectUrlFn: failingWith(new TypeError("Failed to fetch")),
    probeFn: async () => "silent",
  })
  await vi.waitFor(() => expect(alert).toHaveTextContent(/Couldn't reach api\.example at all/i))
  expect(alert).not.toHaveTextContent(/Access-Control/)
})

test("raw per-transport messages survive in Technical details", async () => {
  const alert = await connectAndFail({ connectUrlFn: failingWith(sdkError(500, "boom")) })
  expect(alert).toHaveTextContent(/Streamable HTTP: boom/)
})

test("an example server connects to its own URL", async () => {
  const { fn, calls } = demoBackedConnectUrl()
  renderConnect(<ConnectScreen onConnected={vi.fn()} connectUrlFn={fn} />)
  const deepwiki = EXAMPLE_SERVERS.find((e) => e.name === "DeepWiki")!
  await userEvent.click(screen.getByRole("button", { name: new RegExp(deepwiki.name, "i") }))
  await vi.waitFor(() => expect(calls).toHaveLength(1))
  expect(calls[0]).toEqual({ url: deepwiki.url, headers: {} })
})
