export interface RecentServer { url: string; headers?: Record<string, string>; lastUsed: number }

const KEY = "mcp-explore:recents"
const MAX = 8

export function loadRecents(): RecentServer[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (r): r is RecentServer => typeof r === "object" && r !== null && typeof (r as RecentServer).url === "string",
    )
  } catch {
    return []
  }
}

export function saveRecent(entry: { url: string; headers?: Record<string, string> }, now = Date.now()): RecentServer[] {
  const rest = loadRecents().filter((r) => r.url !== entry.url)
  const headers = entry.headers && Object.keys(entry.headers).length > 0 ? entry.headers : undefined
  const list = [{ url: entry.url, ...(headers ? { headers } : {}), lastUsed: now }, ...rest].slice(0, MAX)
  localStorage.setItem(KEY, JSON.stringify(list))
  return list
}
