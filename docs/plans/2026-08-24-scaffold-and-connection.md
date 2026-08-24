# Scaffold + Demo Server + Connection Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A running Vite + React 19 + TypeScript app with a built-in in-page demo MCP server and a connection layer (Streamable HTTP → SSE fallback) proven end-to-end by a minimal "Try the demo" flow.

**Architecture:** Pure static SPA, zero backend (design spec decision #2). The demo server is a real `McpServer` from the official SDK wired to the client over `InMemoryTransport` — no network, doubles as the test fixture. The connection layer exposes `connectUrl` (Streamable HTTP with automatic legacy-SSE fallback) and `connectDemo`, both returning a `Connection` whose `ServerSnapshot` is everything the future graph UI renders. The App in this plan is a deliberately unstyled proof harness; the real UI is the next plan.

**Tech Stack:** React 19, Vite 7, TypeScript (strict), `@modelcontextprotocol/sdk`, zod, Vitest + RTL + jsdom, CSS Modules.

> **Post-execution note (2026-08-24):** unpinned installs resolved Vite 8.2.2 and TypeScript 7.0.2 (plan prose says "Vite 7"); engines verified compatible with Node 20.20.0 and the full suite + build are green. Do not downgrade to match the prose.

## Global Constraints

- From `docs/specs/2026-08-24-initial-design.md`: no backend ever; no graph/physics libraries; server-derived data is untrusted (never `dangerouslySetInnerHTML`); tokens never in URLs; CSS colours only via custom properties.
- TypeScript strict; model unknown server data as `unknown` and narrow; avoid `any` at protocol boundaries (CLAUDE.md).
- App lives at the **repo root** (no `frontend/` subdir — this project is frontend-only, forever).
- Node 20.20.0 / npm 10.8.2 are installed and sufficient (verified; Vite 7 floor is Node 20.19).
- Commits after every green test cycle. Do NOT push (pushing to main will mean deploy once Pages exists; the human pushes after review).
- The interim UI in Task 4 is a placeholder — do not invest in styling; the visual system needs user confirmation first (CLAUDE.md rule).

---

### Task 1: Vite + React + TypeScript scaffold with Vitest wired

**Files:**
- Create: `package.json` (via npm, then edited), `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/App.module.css`, `src/global.css`, `src/test-setup.ts`, `src/App.test.tsx`
- Modify: `CLAUDE.md` (How to Run section)

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a runnable app (`npm run dev`), `npm test` (Vitest, jsdom, globals), `npm run build` (tsc + vite). Later tasks add files under `src/mcp/` and import React app entry points unchanged.

- [ ] **Step 1: Install dependencies**

```bash
npm init -y
npm install react react-dom @modelcontextprotocol/sdk zod
npm install -D typescript vite @vitejs/plugin-react @types/react @types/react-dom vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

Expected: both installs succeed; `package-lock.json` created.

- [ ] **Step 2: Replace package.json scripts/metadata**

Edit `package.json` so the top-level fields are exactly (keep the generated `dependencies`/`devDependencies` blocks):

```json
{
  "name": "mcp-explore",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 3: Write config files**

`vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves from /<repo>/ — relative asset paths work at any base
  base: "./",
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
  },
})
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"]
}
```

`src/test-setup.ts`:

```ts
import "@testing-library/jest-dom/vitest"
```

- [ ] **Step 4: Write app shell**

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>mcp-explore</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/global.css` (dark-first tokens per design spec decision #12 — placeholder values, real palette comes with the UI plan):

```css
:root {
  --bg: #0d1117;
  --fg: #e6edf3;
  --fg-muted: #8b949e;
  --panel-bg: #161b22;
  --accent-tool: #58a6ff;
  --accent-resource: #3fb950;
  --accent-prompt: #d2a8ff;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font-family: system-ui, sans-serif;
}
```

`src/main.tsx`:

```tsx
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./global.css"
import App from "./App"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

`src/App.tsx` (placeholder — Task 4 replaces it):

```tsx
export default function App() {
  return <h1>mcp-explore</h1>
}
```

`src/App.module.css`:

```css
.app {
  padding: 2rem;
}
```

- [ ] **Step 5: Write the smoke test**

`src/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import App from "./App"

test("renders the app title", () => {
  render(<App />)
  expect(screen.getByText("mcp-explore")).toBeInTheDocument()
})
```

- [ ] **Step 6: Run test and build**

Run: `npm test`
Expected: 1 test file, 1 passed.

Run: `npm run build`
Expected: tsc silent, Vite writes `dist/` with no errors.

- [ ] **Step 7: Update CLAUDE.md How to Run**

Replace the whole `## How to Run` section body with:

```markdown
```bash
npm install
npm run dev          # dev server
npm test             # Tier 1 (Vitest, <5s)
npm run build        # typecheck + production build
```
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: Vite + React 19 + TypeScript scaffold with Vitest"
```

---

### Task 2: Built-in demo MCP server

**Files:**
- Create: `src/mcp/demo/demoServer.ts`
- Test: `src/mcp/demo/demoServer.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks (SDK only).
- Produces: `createDemoServer(): McpServer` and `DEMO_SERVER_NAME = "demo-issue-tracker"`. Task 3's `connectDemo()` and its tests import both. Catalog contract relied on later: 4 tools (`create_issue`, `list_issues`, `close_issue`, `search_issues`), 2 resources (`demo://config` JSON, `demo://readme` markdown), 2 prompts (`triage_issue`, `weekly_summary`).

- [ ] **Step 1: Write the failing test**

`src/mcp/demo/demoServer.test.ts`:

```ts
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
  expect(config.contents[0].mimeType).toBe("application/json")
  expect(JSON.parse(config.contents[0].text as string).project).toBe("mcp-explore demo")
})

test("lists the demo prompts", async () => {
  const client = await connectRaw()
  const { prompts } = await client.listPrompts()
  expect(prompts.map((p) => p.name).sort()).toEqual(["triage_issue", "weekly_summary"])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/mcp/demo/demoServer.test.ts`
Expected: FAIL — cannot resolve `./demoServer`.

- [ ] **Step 3: Implement the demo server**

`src/mcp/demo/demoServer.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/mcp/demo/demoServer.test.ts`
Expected: 4 passed.

> If `registerTool`/`registerResource`/`registerPrompt` don't exist on the installed SDK version, check `node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.d.ts` for the current registration API (older name: `server.tool(...)` / `server.resource(...)` / `server.prompt(...)`) and adapt the calls — the test file is the contract, do not change it.

- [ ] **Step 5: Commit**

```bash
git add src/mcp/demo/demoServer.ts src/mcp/demo/demoServer.test.ts
git commit -m "feat: built-in demo MCP server (in-page, InMemoryTransport)"
```

---

### Task 3: Connection layer — snapshot, connectDemo, connectUrl with SSE fallback

**Files:**
- Create: `src/mcp/types.ts`, `src/mcp/connect.ts`
- Test: `src/mcp/connect.test.ts`

**Interfaces:**
- Consumes: `createDemoServer()`, `DEMO_SERVER_NAME` from Task 2.
- Produces (Task 4 and the future UI plan build on these exact shapes):

```ts
// types.ts
export interface ServerSnapshot {
  serverInfo: Implementation            // { name, version, ... } from SDK types
  instructions?: string
  capabilities: ServerCapabilities
  tools: Tool[]
  resources: Resource[]
  prompts: Prompt[]
}
export type TransportKind = "streamable-http" | "sse" | "in-memory"
export interface Connection {
  client: Client
  transportKind: TransportKind
  snapshot: ServerSnapshot
  close(): Promise<void>
}

// connect.ts
export interface TransportFactories {
  streamable(url: URL, headers: Record<string, string>): Transport
  sse(url: URL, headers: Record<string, string>): Transport
}
export class ConnectFailure extends Error {
  attempts: { kind: TransportKind; error: unknown }[]
}
export function snapshotClient(client: Client): Promise<ServerSnapshot>
export function connectDemo(): Promise<Connection>
export function connectUrl(rawUrl: string, headers?: Record<string, string>, factories?: TransportFactories): Promise<Connection>
```

- [ ] **Step 1: Write types.ts** (types only — no test of its own; exercised by every connect test)

`src/mcp/types.ts`:

```ts
import type { Client } from "@modelcontextprotocol/sdk/client/index.js"
import type {
  Implementation,
  Prompt,
  Resource,
  ServerCapabilities,
  Tool,
} from "@modelcontextprotocol/sdk/types.js"

// Everything the UI renders about a connected server, fetched once at connect.
export interface ServerSnapshot {
  serverInfo: Implementation
  instructions?: string
  capabilities: ServerCapabilities
  tools: Tool[]
  resources: Resource[]
  prompts: Prompt[]
}

export type TransportKind = "streamable-http" | "sse" | "in-memory"

export interface Connection {
  client: Client
  transportKind: TransportKind
  snapshot: ServerSnapshot
  close(): Promise<void>
}
```

- [ ] **Step 2: Write the failing tests**

`src/mcp/connect.test.ts`:

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"
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
  expect(conn.snapshot.tools).toHaveLength(4)
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
  expect(conn.snapshot.tools).toHaveLength(4)
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- src/mcp/connect.test.ts`
Expected: FAIL — cannot resolve `./connect`.

- [ ] **Step 4: Implement connect.ts**

`src/mcp/connect.ts`:

```ts
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- src/mcp/connect.test.ts`
Expected: 5 passed.

- [ ] **Step 6: Run the whole suite**

Run: `npm test`
Expected: all test files pass (App smoke + demo server + connect).

- [ ] **Step 7: Commit**

```bash
git add src/mcp/types.ts src/mcp/connect.ts src/mcp/connect.test.ts
git commit -m "feat: connection layer with snapshot and streamable→SSE fallback"
```

---

### Task 4: Proof-harness App — demo connect flow

**Files:**
- Modify: `src/App.tsx` (replace placeholder), `src/App.module.css`, `src/App.test.tsx` (replace smoke test)

**Interfaces:**
- Consumes: `connectDemo(): Promise<Connection>` from Task 3; `Connection`/`ServerSnapshot` from `src/mcp/types.ts`.
- Produces: nothing later tasks depend on — this UI is a placeholder the graph plan replaces wholesale. Keep it minimal and unstyled.

- [ ] **Step 1: Write the failing test**

Replace `src/App.test.tsx` with:

```tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import App from "./App"

test("Try the demo connects and shows the demo catalog", async () => {
  render(<App />)
  await userEvent.click(screen.getByRole("button", { name: /try the demo/i }))
  expect(await screen.findByText(/demo-issue-tracker/)).toBeInTheDocument()
  expect(screen.getByText("create_issue")).toBeInTheDocument()
  expect(screen.getByText("demo://readme")).toBeInTheDocument()
  expect(screen.getByText("weekly_summary")).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/App.test.tsx`
Expected: FAIL — no button named /try the demo/.

- [ ] **Step 3: Implement the proof-harness App**

Replace `src/App.tsx` with:

```tsx
import { useState } from "react"
import { connectDemo } from "./mcp/connect"
import type { Connection } from "./mcp/types"
import styles from "./App.module.css"

type Phase =
  | { status: "idle" }
  | { status: "connecting" }
  | { status: "connected"; connection: Connection }
  | { status: "error"; message: string }

// Placeholder proof harness: exercises the connection layer end to end.
// The real landing + graph UI (next plan) replaces this component entirely.
export default function App() {
  const [phase, setPhase] = useState<Phase>({ status: "idle" })

  async function handleDemo() {
    setPhase({ status: "connecting" })
    try {
      setPhase({ status: "connected", connection: await connectDemo() })
    } catch (err) {
      setPhase({ status: "error", message: err instanceof Error ? err.message : String(err) })
    }
  }

  return (
    <main className={styles.app}>
      <h1>mcp-explore</h1>
      {phase.status !== "connected" && (
        <button onClick={handleDemo} disabled={phase.status === "connecting"}>
          Try the demo
        </button>
      )}
      {phase.status === "connecting" && <p>Connecting…</p>}
      {phase.status === "error" && <p role="alert">{phase.message}</p>}
      {phase.status === "connected" && <Catalog connection={phase.connection} />}
    </main>
  )
}

function Catalog({ connection }: { connection: Connection }) {
  const { snapshot, transportKind } = connection
  return (
    <section>
      <h2>
        {snapshot.serverInfo.name} <small>v{snapshot.serverInfo.version}</small>
      </h2>
      <p className={styles.muted}>
        via {transportKind} · {snapshot.tools.length} tools · {snapshot.resources.length} resources ·{" "}
        {snapshot.prompts.length} prompts
      </p>
      <h3>Tools</h3>
      <ul>
        {snapshot.tools.map((t) => (
          <li key={t.name}>{t.name}</li>
        ))}
      </ul>
      <h3>Resources</h3>
      <ul>
        {snapshot.resources.map((r) => (
          <li key={r.uri}>{r.uri}</li>
        ))}
      </ul>
      <h3>Prompts</h3>
      <ul>
        {snapshot.prompts.map((p) => (
          <li key={p.name}>{p.name}</li>
        ))}
      </ul>
    </section>
  )
}
```

Replace `src/App.module.css` with:

```css
.app {
  padding: 2rem;
  max-width: 40rem;
}

.muted {
  color: var(--fg-muted);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/App.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full suite + build + eyeball**

Run: `npm test && npm run build`
Expected: all pass, build clean.

Run: `npm run dev` briefly and click "Try the demo" in a browser if available; expect the catalog to render. (Skip without a browser — the RTL test covers the flow.)

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/App.module.css src/App.test.tsx
git commit -m "feat: proof-harness App exercising demo connect end to end"
```

---

### Task 5: Docs sync

**Files:**
- Modify: `docs/architecture-overview.md` (Project structure section), `docs/functional-description.md` (demo server status), `CLAUDE.md` (verify How to Run landed in Task 1)

**Interfaces:**
- Consumes: the final file tree from Tasks 1–4.
- Produces: docs matching reality (CLAUDE.md rule: same-change sync — this is the scaffold change's doc pass).

- [ ] **Step 1: Replace the Project structure section in `docs/architecture-overview.md`**

Replace `**TBD** — write the directory map when the scaffold lands, in the same change.` with:

```markdown
```
index.html            Vite entry
src/
  main.tsx            React bootstrap
  App.tsx             Placeholder proof harness (replaced by the graph UI plan)
  global.css          Dark-first CSS custom properties (placeholder palette)
  mcp/
    types.ts          ServerSnapshot / Connection / TransportKind
    connect.ts        snapshotClient, connectDemo, connectUrl (streamable→SSE fallback)
    demo/
      demoServer.ts   Built-in in-page McpServer (demo-issue-tracker), test fixture
```
Tests are colocated (`*.test.ts[x]`), run by Vitest (jsdom, globals).
```

- [ ] **Step 2: Update `docs/functional-description.md`**

In the "v1 features (designed)" list, change the landing-screen bullet's demo clause to reflect reality:

Replace: `a "Try the demo" button running a built-in in-page simulated MCP server (no network required).`
With: `a "Try the demo" button running the built-in in-page demo server (**built** — `demo-issue-tracker`: 4 tools, 2 resources, 2 prompts over InMemoryTransport; the polished landing screen itself is not yet built).`

- [ ] **Step 3: Verify CLAUDE.md How to Run matches the actual scripts** (from Task 1 Step 7 — fix if drifted)

- [ ] **Step 4: Commit**

```bash
git add docs/architecture-overview.md docs/functional-description.md CLAUDE.md
git commit -m "docs: sync architecture and functional docs with scaffold"
```

---

## Self-review notes

- **Spec coverage (this plan's slice):** scaffold ✓ (Task 1), demo server per design decision + extras list ✓ (Task 2), Streamable→SSE fallback + headers param ✓ (Task 3), capability guards + pagination ✓ (Task 3), untrusted-data rule ✓ (text-only rendering, no raw HTML anywhere), docs sync ✓ (Task 5). Deliberately out of scope for this plan: landing screen UI, graph, detail panel, CORS diagnostics panel, shareable URLs, recent servers, raw JSON toggle, Playwright tier, Pages workflow — next plan(s).
- **Known API risk:** SDK registration method names vary across versions; Task 2 Step 4 carries the adaptation note (tests are the contract).
- **Type consistency:** `Connection`/`ServerSnapshot`/`TransportFactories` signatures in Task 3's Interfaces block match the implementation and Task 4's imports.
