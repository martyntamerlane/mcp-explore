import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"
import { createDemoServer } from "./demo/demoServer"
import type { Connection, ServerSnapshot, TransportKind } from "./types"

const CLIENT_INFO = { name: "mcp-explore", version: "0.1.0" }

export interface TransportFactories {
  streamable(url: URL, headers: Record<string, string>): Transport
  sse(url: URL, headers: Record<string, string>): Transport
}

export const defaultFactories: TransportFactories = {
  streamable: (url, headers) => new StreamableHTTPClientTransport(url, { requestInit: { headers } }),
  // Custom headers on the SSE GET stream are a known limitation of EventSource;
  // requestInit covers the POST side. Documented in the CORS/auth diagnostics later.
  sse: (url, headers) => new SSEClientTransport(url, { requestInit: { headers } }),
}

/**
 * Which half of the attempt failed. A `snapshot` failure means the handshake
 * already succeeded, so the transport and the browser's cross-origin checks are
 * both proven fine — which is the difference between "we couldn't reach it" and
 * "we reached it and then listing broke" (TODO-9).
 */
export type FailurePhase = "connect" | "snapshot"

export interface ConnectAttempt {
  kind: TransportKind
  phase: FailurePhase
  error: unknown
}

export class ConnectFailure extends Error {
  constructor(public attempts: ConnectAttempt[]) {
    super("Could not connect over any supported transport")
    this.name = "ConnectFailure"
  }
}

/**
 * Pagination is driven by a cursor the *server* chooses, and the server is
 * untrusted: one that returns the same cursor forever — or a fresh one forever
 * — would spin this loop until the tab died. Both are bounded (TODO-9).
 */
const MAX_PAGES = 100

async function listAll<R extends { nextCursor?: string }, T>(
  fetchPage: (params: { cursor?: string }) => Promise<R>,
  items: (page: R) => T[],
): Promise<T[]> {
  const out: T[] = []
  const seen = new Set<string>()
  let cursor: string | undefined
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await fetchPage(cursor ? { cursor } : {})
    out.push(...items(result))
    cursor = result.nextCursor
    // Stopping early keeps what we have: a partial list beats an empty one, and
    // beats a hung tab.
    if (cursor === undefined || seen.has(cursor)) return out
    seen.add(cursor)
  }
  return out
}

export async function snapshotClient(client: Client): Promise<ServerSnapshot> {
  const capabilities = client.getServerCapabilities() ?? {}
  const serverInfo = client.getServerVersion() ?? { name: "unknown", version: "unknown" }
  const instructions = client.getInstructions()
  return {
    serverInfo,
    instructions,
    capabilities,
    tools: capabilities.tools ? await listAll((p) => client.listTools(p), (r) => r.tools) : [],
    resources: capabilities.resources
      ? await listAll((p) => client.listResources(p), (r) => r.resources)
      : [],
    prompts: capabilities.prompts ? await listAll((p) => client.listPrompts(p), (r) => r.prompts) : [],
  }
}

export async function connectDemo(): Promise<Connection> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const server = createDemoServer()
  const client = new Client(CLIENT_INFO)
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
  const snapshot = await snapshotClient(client)
  return {
    client,
    transportKind: "in-memory",
    snapshot,
    close: async () => {
      // try/finally so a failing client close can't leak the server side (TODO-9).
      try {
        await client.close()
      } finally {
        await server.close()
      }
    },
  }
}

export async function connectUrl(
  rawUrl: string,
  headers: Record<string, string> = {},
  factories: TransportFactories = defaultFactories,
): Promise<Connection> {
  const url = new URL(rawUrl) // invalid URLs throw here; callers surface the message
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Unsupported scheme "${url.protocol}" — only http:// and https:// MCP servers can be reached from a browser`)
  }
  const attempts: ConnectAttempt[] = []
  const order = [
    { kind: "streamable-http" as const, make: factories.streamable },
    { kind: "sse" as const, make: factories.sse },
  ]
  for (const { kind, make } of order) {
    const client = new Client(CLIENT_INFO)
    let phase: FailurePhase = "connect"
    try {
      await client.connect(make(url, headers))
      phase = "snapshot"
      const snapshot = await snapshotClient(client)
      return { client, transportKind: kind, snapshot, close: () => client.close() }
    } catch (error) {
      attempts.push({ kind, phase, error })
      await client.close().catch(() => {})
    }
  }
  throw new ConnectFailure(attempts)
}
