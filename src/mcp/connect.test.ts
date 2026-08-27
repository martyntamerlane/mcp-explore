import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"
import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { createDemoServer, DEMO_SERVER_NAME } from "./demo/demoServer"
import { ConnectFailure, connectDemo, connectUrl, type TransportFactories } from "./connect"

// A factory whose transport is backed by a live demo server — lets us test
// connectUrl's transport selection without any network.
function demoBackedTransport(): Transport {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  void createDemoServer().connect(serverTransport)
  return clientTransport
}

function failingTransport(message: string): Transport {
  return {
    async start() {
      throw new Error(message)
    },
    async send() {},
    async close() {},
  }
}

test("connectDemo yields a full snapshot over in-memory transport", async () => {
  const conn = await connectDemo()
  expect(conn.transportKind).toBe("in-memory")
  expect(conn.snapshot.serverInfo.name).toBe(DEMO_SERVER_NAME)
  expect(conn.snapshot.tools).toHaveLength(6)
  expect(conn.snapshot.resources).toHaveLength(2)
  expect(conn.snapshot.prompts).toHaveLength(2)
  expect(conn.snapshot.instructions).toMatch(/simulated issue tracker/i)
  await conn.close()
})

test("connectUrl prefers streamable HTTP when it works", async () => {
  const factories: TransportFactories = {
    streamable: () => demoBackedTransport(),
    sse: () => {
      throw new Error("sse factory must not be called when streamable succeeds")
    },
  }
  const conn = await connectUrl("https://example.com/mcp", {}, factories)
  expect(conn.transportKind).toBe("streamable-http")
  expect(conn.snapshot.serverInfo.name).toBe(DEMO_SERVER_NAME)
  await conn.close()
})

test("connectUrl falls back to SSE when streamable fails", async () => {
  const factories: TransportFactories = {
    streamable: () => failingTransport("405 from POST"),
    sse: () => demoBackedTransport(),
  }
  const conn = await connectUrl("https://example.com/mcp", {}, factories)
  expect(conn.transportKind).toBe("sse")
  expect(conn.snapshot.tools).toHaveLength(6)
  await conn.close()
})

test("connectUrl throws ConnectFailure with both attempts when everything fails", async () => {
  const factories: TransportFactories = {
    streamable: () => failingTransport("streamable boom"),
    sse: () => failingTransport("sse boom"),
  }
  const err = await connectUrl("https://example.com/mcp", {}, factories).catch((e) => e)
  expect(err).toBeInstanceOf(ConnectFailure)
  expect(err.attempts.map((a: { kind: string }) => a.kind)).toEqual(["streamable-http", "sse"])
  expect(String(err.attempts[0].error)).toMatch(/streamable boom/)
})

test("snapshot skips list calls for capabilities the server lacks", async () => {
  // A server with nothing registered advertises no tools/resources/prompts
  // capabilities; calling listTools against it would throw. The snapshot must
  // guard on capabilities instead of trying and catching.
  const bare = new McpServer({ name: "bare", version: "0.0.1" })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  void bare.connect(serverTransport)
  const factories: TransportFactories = {
    streamable: () => clientTransport,
    sse: () => {
      throw new Error("unused")
    },
  }
  const conn = await connectUrl("https://example.com/mcp", {}, factories)
  expect(conn.snapshot.tools).toEqual([])
  expect(conn.snapshot.resources).toEqual([])
  expect(conn.snapshot.prompts).toEqual([])
  await conn.close()
})

function paginatedTransport(): Transport {
  const server = new Server({ name: "paginated", version: "0.0.1" }, { capabilities: { tools: {} } })
  server.setRequestHandler(ListToolsRequestSchema, async (req) => {
    if (!req.params?.cursor) {
      return { tools: [{ name: "page1_tool", inputSchema: { type: "object" as const } }], nextCursor: "page2" }
    }
    return { tools: [{ name: "page2_tool", inputSchema: { type: "object" as const } }] }
  })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  void server.connect(serverTransport)
  return clientTransport
}

test("snapshot follows nextCursor pagination and concatenates all pages", async () => {
  const factories: TransportFactories = {
    streamable: () => paginatedTransport(),
    sse: () => {
      throw new Error("unused")
    },
  }
  const conn = await connectUrl("https://example.com/mcp", {}, factories)
  expect(conn.snapshot.tools.map((t) => t.name)).toEqual(["page1_tool", "page2_tool"])
  await conn.close()
})

test("connectUrl rejects non-http(s) schemes before any transport attempt", async () => {
  const factories: TransportFactories = {
    streamable: () => {
      throw new Error("factory must not be called")
    },
    sse: () => {
      throw new Error("factory must not be called")
    },
  }
  await expect(connectUrl("javascript:alert(1)", {}, factories)).rejects.toThrow(/http/)
})
