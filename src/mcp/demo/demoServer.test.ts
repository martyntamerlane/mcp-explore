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
    "generate_release_notes",
    "list_issues",
    "project_pulse",
    "search_issues",
  ])
  const createIssue = tools.find((t) => t.name === "create_issue")!
  expect(createIssue.description).toMatch(/create a new issue/i)
})

test("every demo tool is zero-required — all are runnable from the deck (spec §5)", async () => {
  const client = await connectRaw()
  const { tools } = await client.listTools()
  for (const t of tools) {
    expect(t.inputSchema.required ?? [], `${t.name} must have no required args`).toEqual([])
  }
})

test("read-only tools carry readOnlyHint for the instant run class", async () => {
  const client = await connectRaw()
  const { tools } = await client.listTools()
  const hinted = tools.filter((t) => t.annotations?.readOnlyHint === true).map((t) => t.name)
  expect(hinted.sort()).toEqual(["list_issues", "project_pulse", "search_issues"])
})

test("project_pulse returns a satisfying JSON dashboard with zero args", async () => {
  const client = await connectRaw()
  const result = await client.callTool({ name: "project_pulse", arguments: {} })
  const content = result.content as { type: string; text: string }[]
  const pulse = JSON.parse(content[0].text)
  expect(pulse.velocity.length).toBeGreaterThan(4)
  expect(pulse.sparkline).toMatch(/[▁▂▃▄▅▆▇█]/)
  expect(pulse.recentActivity.length).toBeGreaterThan(2)
})

test("generate_release_notes returns markdown release notes with zero args", async () => {
  const client = await connectRaw()
  const result = await client.callTool({ name: "generate_release_notes", arguments: {} })
  const content = result.content as { type: string; text: string }[]
  expect(content[0].text).toMatch(/^# v1\.4\.0/)
})

test("create_issue and search_issues run with defaults when called argless", async () => {
  const client = await connectRaw()
  const created = await client.callTool({ name: "create_issue", arguments: {} })
  expect((created.content as { text: string }[])[0].text).toMatch(/untitled issue/i)
  const found = await client.callTool({ name: "search_issues", arguments: {} })
  expect((found.content as { text: string }[])[0].text).toMatch(/\d+ issue/)
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
