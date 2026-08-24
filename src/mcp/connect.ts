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

export class ConnectFailure extends Error {
  constructor(public attempts: { kind: TransportKind; error: unknown }[]) {
    super("Could not connect over any supported transport")
    this.name = "ConnectFailure"
  }
}

async function listAll<R extends { nextCursor?: string }, T>(
  fetchPage: (params: { cursor?: string }) => Promise<R>,
  items: (page: R) => T[],
): Promise<T[]> {
  const out: T[] = []
  let cursor: string | undefined
  do {
    const page = await fetchPage(cursor ? { cursor } : {})
    out.push(...items(page))
    cursor = page.nextCursor
  } while (cursor)
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
      await client.close()
      await server.close()
    },
  }
}

export async function connectUrl(
  rawUrl: string,
  headers: Record<string, string> = {},
  factories: TransportFactories = defaultFactories,
): Promise<Connection> {
  const url = new URL(rawUrl) // invalid URLs throw here; callers surface the message
  const attempts: { kind: TransportKind; error: unknown }[] = []
  const order = [
    { kind: "streamable-http" as const, make: factories.streamable },
    { kind: "sse" as const, make: factories.sse },
  ]
  for (const { kind, make } of order) {
    const client = new Client(CLIENT_INFO)
    try {
      await client.connect(make(url, headers))
      const snapshot = await snapshotClient(client)
      return { client, transportKind: kind, snapshot, close: () => client.close() }
    } catch (error) {
      attempts.push({ kind, error })
      await client.close().catch(() => {})
    }
  }
  throw new ConnectFailure(attempts)
}
