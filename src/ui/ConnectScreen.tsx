import { useEffect, useRef, useState } from "react"
import { connectDemo as realConnectDemo, connectUrl as realConnectUrl } from "../mcp/connect"
import type { Connection } from "../mcp/types"
import ConnectError from "./ConnectError"
import Prism from "./deck/Prism"
import ModeToggle from "./ModeToggle"
import { loadRecents, saveRecent, type RecentServer } from "./recents"
import styles from "./ConnectScreen.module.css"

export interface ConnectScreenProps {
  onConnected: (conn: Connection, source: { url?: string }) => void
  initialUrl?: string
  autoConnect?: boolean
  connectUrlFn?: typeof realConnectUrl
  connectDemoFn?: typeof realConnectDemo
}

interface HeaderRow { name: string; value: string }

export default function ConnectScreen({
  onConnected,
  initialUrl,
  autoConnect,
  connectUrlFn = realConnectUrl,
  connectDemoFn = realConnectDemo,
}: ConnectScreenProps) {
  const [url, setUrl] = useState(initialUrl ?? "")
  const [showHeaders, setShowHeaders] = useState(false)
  const [rows, setRows] = useState<HeaderRow[]>([{ name: "", value: "" }])
  const [remember, setRemember] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [recents, setRecents] = useState<RecentServer[]>(() => loadRecents())
  const autoRan = useRef(false)

  const headersOf = (r: HeaderRow[]) =>
    Object.fromEntries(r.filter((h) => h.name.trim() !== "").map((h) => [h.name.trim(), h.value]))

  async function connectTo(target: string, headers: Record<string, string>, persist: Record<string, string> | undefined) {
    setBusy(true)
    setError(null)
    try {
      const conn = await connectUrlFn(target, headers)
      setRecents(saveRecent({ url: target, headers: persist }))
      onConnected(conn, { url: target })
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (autoConnect && initialUrl && !autoRan.current) {
      autoRan.current = true
      void connectTo(initialUrl, {}, undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleDemo() {
    setBusy(true)
    setError(null)
    try {
      onConnected(await connectDemoFn(), {})
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className={styles.hero}>
      <div className={styles.modeCorner}>
        <ModeToggle />
      </div>
      <p className={styles.kicker}>MCP EXPLORE</p>
      <h1 className={styles.title}>See inside any MCP server.</h1>
      <p className={styles.sub}>Paste a server URL — get a living control deck of its tools, resources and prompts.</p>
      <p className={styles.gloss}>
        MCP is how apps hand tools and data to AI assistants — this shows you what a server offers.
      </p>

      <div className={styles.doors}>
        <section className={styles.door} aria-label="Connect your server">
          <h2 className={styles.doorTitle}>Connect your server</h2>
          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault()
              if (url.trim()) {
                const h = headersOf(rows)
                void connectTo(url.trim(), h, remember ? h : undefined)
              }
            }}
          >
            <input
              aria-label="Server URL"
              className={styles.url}
              placeholder="https://your-server.example/mcp"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              spellCheck={false}
            />
            <button className={styles.connect} disabled={busy || url.trim() === ""}>
              {busy ? "Connecting…" : "Connect"}
            </button>
          </form>

          <button type="button" className={styles.disclose} onClick={() => setShowHeaders((s) => !s)}>
            {showHeaders ? "▾" : "▸"} Add headers
          </button>

          {showHeaders && (
            <div className={styles.headers}>
              {rows.map((row, i) => (
                <div key={i} className={styles.headerRow}>
                  <input
                    aria-label={`Header name ${i + 1}`}
                    placeholder="Authorization"
                    value={row.name}
                    onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))}
                  />
                  <input
                    aria-label={`Header value ${i + 1}`}
                    placeholder="Bearer …"
                    value={row.value}
                    onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))}
                  />
                </div>
              ))}
              <div className={styles.headerActions}>
                <button type="button" onClick={() => setRows([...rows, { name: "", value: "" }])}>
                  + row
                </button>
                <label className={styles.remember}>
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  Remember headers on this device
                </label>
              </div>
            </div>
          )}

          {recents.length > 0 && (
            <section className={styles.recents} aria-label="Recent servers">
              <p className={styles.microlabel}>RECENT</p>
              {recents.map((r) => (
                <button
                  key={r.url}
                  type="button"
                  className={styles.recent}
                  disabled={busy}
                  onClick={() => void connectTo(r.url, r.headers ?? {}, r.headers)}
                >
                  {r.url}
                </button>
              ))}
            </section>
          )}
        </section>

        <section className={`${styles.door} ${styles.demoDoor}`} aria-label="Explore a live demo">
          <Prism className={styles.doorPrism} />
          <h2 className={styles.doorTitle}>Explore a live demo</h2>
          <p className={styles.doorSub}>No setup — a demo server runs entirely in your browser tab.</p>
          <button type="button" className={styles.demo} onClick={() => void handleDemo()} disabled={busy}>
            Explore the demo
          </button>
        </section>
      </div>

      {error !== null && <ConnectError error={error} />}
    </main>
  )
}
