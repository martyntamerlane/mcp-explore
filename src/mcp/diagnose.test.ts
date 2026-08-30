import { ConnectFailure } from "./connect"
import { diagnose, isLocalHostname, statusOf, wantsProbe, type DiagnoseEnv } from "./diagnose"

const HOSTED: DiagnoseEnv = { pageUrl: "https://martyntamerlane.github.io/mcp-explore/", online: true }

/** What the SDK's StreamableHTTPError looks like to a duck-typed reader. */
const sdkError = (code: number, message: string) => Object.assign(new Error(message), { code })
/** What a cross-origin refusal, a dead host and an offline tab all look like. */
const opaque = () => new TypeError("Failed to fetch")
const failure = (...errors: unknown[]) =>
  new ConnectFailure(
    errors.map((error, i) => ({ kind: i === 0 ? ("streamable-http" as const) : ("sse" as const), phase: "connect" as const, error })),
  )
const afterHandshake = (error: unknown) =>
  new ConnectFailure([{ kind: "streamable-http", phase: "snapshot", error }])

test("statusOf reads the SDK's numeric code", () => {
  expect(statusOf(sdkError(401, "Streamable HTTP error: Error POSTing to endpoint: nope"))).toBe(401)
  expect(statusOf(sdkError(503, "x"))).toBe(503)
})

test("statusOf falls back to the legacy SSE transport's message text", () => {
  expect(statusOf(new Error("Error POSTing to endpoint (HTTP 404): not found"))).toBe(404)
})

test("statusOf ignores the content-type sentinel and opaque failures", () => {
  expect(statusOf(sdkError(-1, "Unexpected content type: text/html"))).toBeUndefined()
  expect(statusOf(opaque())).toBeUndefined()
})

test("an error thrown before any transport ran carries its own message", () => {
  const d = diagnose("ftp://x", new Error('Unsupported scheme "ftp:"'), HOSTED)
  expect(d).toEqual({ kind: "other", message: 'Unsupported scheme "ftp:"' })
})

test("a readable status outranks an opaque failure, whichever transport produced it", () => {
  // Reading any status at all is proof the browser let us see the response,
  // so CORS is not the problem no matter what the other attempt looks like.
  const d = diagnose("https://api.example/mcp", failure(opaque(), sdkError(401, "unauthorized")), HOSTED)
  expect(d).toMatchObject({ kind: "http-status", status: 401 })
})

test("an unexpected content type means a response arrived, so it is not a CORS verdict", () => {
  const d = diagnose("https://site.example", failure(sdkError(-1, "Unexpected content type: text/html")), HOSTED)
  expect(d.kind).toBe("not-mcp")
})

test("a successful status that still failed the handshake is not-mcp, not a refusal", () => {
  // ISSUE-10, found live against raw.githubusercontent.com: the SSE transport
  // carries the real status (200) alongside its own wording for the same
  // condition, and a 200 read as "the server refused the request" is nonsense.
  const d = diagnose(
    "https://raw.githubusercontent.com/o/r/main/README.md",
    failure(new TypeError("Failed to fetch"), sdkError(200, 'SSE error: Invalid content type, expected "text/event-stream"')),
    HOSTED,
  )
  expect(d).toMatchObject({ kind: "not-mcp" })
})

test("a redirect status is likewise not treated as a refusal", () => {
  const d = diagnose("https://site.example", failure(sdkError(302, "SSE error: unexpected redirect")), HOSTED)
  expect(d.kind).toBe("not-mcp")
})

test("a failure after the handshake is a listing failure, never a CORS one", () => {
  // The handshake already crossed the origin boundary, so no probe would be
  // asking about the right thing.
  const d = diagnose("https://api.example/mcp", afterHandshake(new TypeError("Failed to fetch")), HOSTED)
  expect(d).toMatchObject({ kind: "listing" })
  expect(wantsProbe(d)).toBe(false)
})

test("a local target from a hosted page is Private Network Access, not CORS", () => {
  const d = diagnose("http://localhost:3000/mcp", failure(opaque()), HOSTED)
  // Checked before mixed content deliberately: http://localhost is a
  // potentially-trustworthy URL, so mixed-content blocking never applies to it.
  expect(d).toEqual({ kind: "private-host", host: "localhost:3000" })
})

test("a local target from a local page is not flagged — that is just dev", () => {
  const local: DiagnoseEnv = { pageUrl: "http://localhost:5173/", online: true }
  expect(diagnose("http://localhost:3000/mcp", failure(opaque()), local).kind).toBe("opaque")
})

test("an http target from an https page is mixed content, and offers the https twin", () => {
  const d = diagnose("http://api.example/mcp", failure(opaque()), HOSTED)
  expect(d).toEqual({ kind: "mixed-content", secureUrl: "https://api.example/mcp" })
})

test("an offline browser is reported as offline rather than blamed on the server", () => {
  expect(diagnose("https://api.example/mcp", failure(opaque()), { ...HOSTED, online: false }).kind).toBe("offline")
})

test("the probe decides between a refusing server and a silent one", () => {
  const err = failure(opaque(), opaque())
  expect(diagnose("https://api.example/mcp", err, { ...HOSTED, probe: "answered" })).toEqual({
    kind: "cors-refused",
    host: "api.example",
  })
  expect(diagnose("https://api.example/mcp", err, { ...HOSTED, probe: "silent" })).toEqual({
    kind: "unreachable",
    host: "api.example",
  })
})

test("an inconclusive probe stays hedged rather than claiming the server is silent", () => {
  const d = diagnose("https://api.example/mcp", failure(opaque()), { ...HOSTED, probe: "inconclusive" })
  expect(d.kind).toBe("opaque")
})

test("only the opaque verdict is worth spending a probe on", () => {
  expect(wantsProbe({ kind: "opaque", host: "x" })).toBe(true)
  expect(wantsProbe({ kind: "http-status", status: 404, detail: "" })).toBe(false)
  expect(wantsProbe({ kind: "private-host", host: "localhost" })).toBe(false)
})

test("isLocalHostname covers loopback, link-local and the RFC1918 blocks", () => {
  for (const host of ["localhost", "app.localhost", "printer.local", "127.0.0.1", "::1", "10.0.0.5", "192.168.1.1", "172.16.0.1", "172.31.255.1", "169.254.1.1"]) {
    expect(isLocalHostname(host), host).toBe(true)
  }
  for (const host of ["example.com", "172.15.0.1", "172.32.0.1", "11.0.0.1", "huggingface.co"]) {
    expect(isLocalHostname(host), host).toBe(false)
  }
})
