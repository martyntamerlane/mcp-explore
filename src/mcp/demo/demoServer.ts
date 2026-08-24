import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

export const DEMO_SERVER_NAME = "demo-issue-tracker"

// A real MCP server that runs in-page over InMemoryTransport. It exists so the
// landing page's "Try the demo" always works with zero network, and so tests
// have a genuine protocol fixture. Handlers return canned data; nothing persists.
export function createDemoServer(): McpServer {
  const server = new McpServer(
    { name: DEMO_SERVER_NAME, version: "1.0.0" },
    {
      instructions:
        "A simulated issue tracker used to demo mcp-explore. Data is canned; nothing persists between calls.",
    },
  )

  server.registerTool(
    "create_issue",
    {
      description: "Create a new issue in the tracker.",
      inputSchema: {
        title: z.string().describe("Issue title"),
        body: z.string().optional().describe("Markdown body"),
        labels: z.array(z.string()).optional().describe("Labels to apply"),
        priority: z.enum(["low", "medium", "high"]).optional().describe("Triage priority"),
      },
    },
    async ({ title }) => ({
      content: [{ type: "text", text: `Created issue #104: ${title}` }],
    }),
  )

  server.registerTool(
    "list_issues",
    {
      description: "List issues, optionally filtered by status.",
      inputSchema: {
        status: z.enum(["open", "closed", "all"]).optional().describe("Filter by status"),
        limit: z.number().int().min(1).max(100).optional().describe("Max results"),
      },
    },
    async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify([
            { id: 101, title: "Graph looks wrong at 80 nodes", status: "open" },
            { id: 102, title: "CORS diagnostic wording", status: "open" },
            { id: 103, title: "Dark theme contrast", status: "closed" },
          ]),
        },
      ],
    }),
  )

  server.registerTool(
    "close_issue",
    {
      description: "Close an issue by id.",
      inputSchema: {
        id: z.number().int().describe("Issue id"),
        reason: z.string().optional().describe("Why it was closed"),
      },
    },
    async ({ id }) => ({
      content: [{ type: "text", text: `Closed issue #${id}` }],
    }),
  )

  server.registerTool(
    "search_issues",
    {
      description: "Full-text search across issue titles and bodies.",
      inputSchema: {
        query: z.string().describe("Search query"),
      },
    },
    async ({ query }) => ({
      content: [{ type: "text", text: `No results for "${query}" (demo data is small)` }],
    }),
  )

  server.registerResource(
    "config",
    "demo://config",
    { description: "Tracker configuration", mimeType: "application/json" },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(
            { project: "mcp-explore demo", defaultPriority: "medium", labels: ["bug", "design", "docs"] },
            null,
            2,
          ),
        },
      ],
    }),
  )

  server.registerResource(
    "readme",
    "demo://readme",
    { description: "About this demo server", mimeType: "text/markdown" },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: "# Demo issue tracker\n\nThis MCP server runs entirely inside your browser tab. Nothing you see here touches a network.",
        },
      ],
    }),
  )

  server.registerPrompt(
    "triage_issue",
    {
      description: "Draft a triage assessment for an issue.",
      argsSchema: { issue_id: z.string().describe("Issue id to triage") },
    },
    ({ issue_id }) => ({
      messages: [
        {
          role: "user",
          content: { type: "text", text: `Triage issue ${issue_id}: assess severity, suggest labels and priority.` },
        },
      ],
    }),
  )

  server.registerPrompt(
    "weekly_summary",
    { description: "Summarise this week's issue activity." },
    () => ({
      messages: [
        {
          role: "user",
          content: { type: "text", text: "Summarise this week's issue activity in three bullet points." },
        },
      ],
    }),
  )

  return server
}
