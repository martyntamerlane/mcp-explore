export interface RecentServer { url: string; headers?: Record<string, string>; lastUsed: number }

const KEY = "mcp-explore:recents"
const MAX = 8

/**
 * localStorage is user-editable and shared with anything else on this origin,
 * so a stored entry is untrusted input like any other. `url` was already
 * checked; `headers` and `lastUsed` were not (TODO-12) — and a header whose
 * value is not a string would either be sent to the user's server or thrown at
 * the render as an object.
 */
function sanitize(raw: unknown): RecentServer | null {
  if (typeof raw !== "object" || raw === null) return null
  const entry = raw as Record<string, unknown>
  if (typeof entry.url !== "string" || entry.url === "") return null
  const lastUsed = typeof entry.lastUsed === "number" && Number.isFinite(entry.lastUsed) ? entry.lastUsed : 0
  let headers: Record<string, string> | undefined
  if (typeof entry.headers === "object" && entry.headers !== null && !Array.isArray(entry.headers)) {
    // Keep the string-valued pairs rather than dropping the whole entry: a
    // usable server URL is worth more than one malformed header.
    const pairs = Object.entries(entry.headers).filter((pair): pair is [string, string] => typeof pair[1] === "string")
    if (pairs.length > 0) headers = Object.fromEntries(pairs)
  }
  return { url: entry.url, ...(headers ? { headers } : {}), lastUsed }
}

export function loadRecents(): RecentServer[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(sanitize).filter((r): r is RecentServer => r !== null)
  } catch {
    return []
  }
}

export function saveRecent(entry: { url: string; headers?: Record<string, string> }, now = Date.now()): RecentServer[] {
  const rest = loadRecents().filter((r) => r.url !== entry.url)
  const headers = entry.headers && Object.keys(entry.headers).length > 0 ? entry.headers : undefined
  const list = [{ url: entry.url, ...(headers ? { headers } : {}), lastUsed: now }, ...rest].slice(0, MAX)
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // Storage may be full, disabled, or blocked (e.g. private browsing). Fall back to
    // the in-memory list for this session rather than locking the user out of connecting.
  }
  return list
}
