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

  // Every demo tool is zero-required (redesign spec §5: all demo tools are
  // runnable from the deck) — required-looking inputs are optional with handler
  // defaults, so an argless tools/call always succeeds.
  server.registerTool(
    "create_issue",
    {
      description: "Create a new issue in the tracker.",
      inputSchema: {
        title: z.string().optional().describe("Issue title"),
        body: z.string().optional().describe("Markdown body"),
        labels: z.array(z.string()).optional().describe("Labels to apply"),
        priority: z.enum(["low", "medium", "high"]).optional().describe("Triage priority"),
      },
    },
    async ({ title }) => ({
      content: [{ type: "text", text: `Created issue #104: ${title ?? "Untitled issue"}` }],
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
      annotations: { readOnlyHint: true },
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
        id: z.number().int().optional().describe("Issue id"),
        reason: z.string().optional().describe("Why it was closed"),
      },
    },
    async ({ id }) => ({
      content: [{ type: "text", text: `Closed issue #${id ?? 104}` }],
    }),
  )

  server.registerTool(
    "search_issues",
    {
      description: "Full-text search across issue titles and bodies.",
      inputSchema: {
        query: z.string().optional().describe("Search query — empty matches everything"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ query }) => {
      const all = [
        { id: 101, title: "Graph looks wrong at 80 nodes", status: "open" },
        { id: 102, title: "CORS diagnostic wording", status: "open" },
        { id: 103, title: "Dark theme contrast", status: "closed" },
      ]
      const q = (query ?? "").toLowerCase()
      const hits = all.filter((i) => i.title.toLowerCase().includes(q))
      return {
        content: [
          { type: "text", text: `${hits.length} issue${hits.length === 1 ? "" : "s"} matched` },
          { type: "text", text: JSON.stringify(hits, null, 2) },
        ],
      }
    },
  )

  // Showcase tool #1 (spec §5 demo curation): the one-click portfolio moment —
  // read-only, zero-input, returns a live-feeling dashboard that lands well in the panel.
  server.registerTool(
    "project_pulse",
    {
      description: "A live snapshot of tracker health: counts, velocity, recent activity.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              project: "mcp-explore demo",
              open: 2,
              closedThisWeek: 5,
              velocity: [3, 5, 4, 7, 6, 9, 8],
              sparkline: "▂▄▃▆▅█▇",
              recentActivity: [
                { at: "2026-08-26T09:12:00Z", event: "issue #101 labeled 'design'" },
                { at: "2026-08-26T08:47:00Z", event: "issue #103 closed — fixed by #98" },
                { at: "2026-08-25T17:30:00Z", event: "issue #102 assigned to ada" },
                { at: "2026-08-25T16:02:00Z", event: "issue #104 opened" },
              ],
            },
            null,
            2,
          ),
        },
      ],
    }),
  )

  // Showcase tool #2: the arm-then-fire moment — drafts something, so no
  // readOnlyHint; still zero-required.
  server.registerTool(
    "generate_release_notes",
    {
      description: "Draft release notes for the next version from recent issue activity.",
      inputSchema: {
        tone: z.enum(["neutral", "enthusiastic"]).optional().describe("Voice of the notes"),
      },
    },
    async ({ tone }) => ({
      content: [
        {
          type: "text",
          text: [
            `# v1.4.0${tone === "enthusiastic" ? " — a big one!" : ""}`,
            "",
            "## Fixed",
            "- Graph readability at 80+ nodes (#101)",
            "- Dark theme contrast on muted labels (#103)",
            "",
            "## Improved",
            "- Clearer CORS diagnostic wording (#102)",
            "",
            "## Notes",
            "Generated by the demo issue tracker — nothing here touched a network.",
          ].join("\n"),
        },
      ],
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
