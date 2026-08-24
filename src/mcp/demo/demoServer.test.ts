import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { createDemoServer, DEMO_SERVER_NAME } from "./demoServer"

async function connectRaw() {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const server = createDemoServer()
  const client = new Client({ name: "test-client", version: "0.0.0" })
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
  return client
}

test("identifies itself with name, version, and instructions", async () => {
  const client = await connectRaw()
  expect(client.getServerVersion()?.name).toBe(DEMO_SERVER_NAME)
  expect(client.getServerVersion()?.version).toBe("1.0.0")
  expect(client.getInstructions()).toMatch(/simulated issue tracker/i)
})

test("lists the demo tools with schemas", async () => {
  const client = await connectRaw()
  const { tools } = await client.listTools()
  expect(tools.map((t) => t.name).sort()).toEqual([
    "close_issue",
    "create_issue",
    "list_issues",
    "search_issues",
  ])
  const createIssue = tools.find((t) => t.name === "create_issue")!
  expect(createIssue.description).toMatch(/create a new issue/i)
  expect(createIssue.inputSchema.required).toEqual(["title"])
})

test("lists and reads the demo resources", async () => {
  const client = await connectRaw()
  const { resources } = await client.listResources()
  expect(resources.map((r) => r.uri).sort()).toEqual(["demo://config", "demo://readme"])
  const config = await client.readResource({ uri: "demo://config" })
  const first = config.contents[0]
  expect(first.mimeType).toBe("application/json")
  if (!("text" in first) || typeof first.text !== "string") throw new Error("expected text resource contents")
  expect(JSON.parse(first.text).project).toBe("mcp-explore demo")
})

test("lists the demo prompts", async () => {
  const client = await connectRaw()
  const { prompts } = await client.listPrompts()
  expect(prompts.map((p) => p.name).sort()).toEqual(["triage_issue", "weekly_summary"])
})
