/**
 * Public MCP servers offered as one-click examples on the landing page.
 *
 * Every entry was verified with a browser-shaped request — an `Origin` header,
 * `initialize`, `tools/list` and a real `tools/call` — on 2026-08-30. The bar is
 * higher than "it connects": the deck has a Run panel, so an example whose tool
 * calls 401 anonymously (Jina) is worse than no example at all. Servers that
 * speak MCP but send no CORS headers (Shopify storefronts) can never appear here
 * while the app has no proxy.
 */
export interface ExampleServer {
  /** Display name — the operator's own, so the chip is recognisable. */
  name: string
  url: string
  /** What a first-time visitor gets out of connecting, in a few words. */
  note: string
}

export const EXAMPLE_SERVERS: ExampleServer[] = [
  { name: "DeepWiki", url: "https://mcp.deepwiki.com/mcp", note: "ask about any GitHub repo" },
  { name: "TripGo", url: "https://tripgo-mcp-server.skedgo-account.workers.dev/mcp", note: "plan a public-transport journey" },
  { name: "Exa", url: "https://mcp.exa.ai/mcp", note: "search the web" },
  { name: "Hugging Face", url: "https://huggingface.co/mcp", note: "models, datasets and spaces" },
]
