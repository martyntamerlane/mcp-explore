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
