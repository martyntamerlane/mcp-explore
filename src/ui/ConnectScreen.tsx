import { useEffect, useRef, useState } from "react"
import { connectDemo as realConnectDemo, connectUrl as realConnectUrl } from "../mcp/connect"
import { diagnose, wantsProbe, type Diagnosis } from "../mcp/diagnose"
import { probeReachable as realProbeReachable } from "../mcp/probe"
import type { Connection } from "../mcp/types"
import ConnectError from "./ConnectError"
import Prism from "./deck/Prism"
import { EXAMPLE_SERVERS } from "./examples"
import ModeToggle from "./ModeToggle"
import { loadRecents, saveRecent, type RecentServer } from "./recents"
import { pickTagline } from "./taglines"
import styles from "./ConnectScreen.module.css"

export interface ConnectScreenProps {
  onConnected: (conn: Connection, source: { url?: string }) => void
  initialUrl?: string
  autoConnect?: boolean
  connectUrlFn?: typeof realConnectUrl
  connectDemoFn?: typeof realConnectDemo
  /** Injectable so tests never let the reachability probe touch the network. */
  probeFn?: typeof realProbeReachable
}

interface HeaderRow { name: string; value: string }

export default function ConnectScreen({
  onConnected,
  initialUrl,
  autoConnect,
  connectUrlFn = realConnectUrl,
  connectDemoFn = realConnectDemo,
  probeFn = realProbeReachable,
}: ConnectScreenProps) {
  const [url, setUrl] = useState(initialUrl ?? "")
  const [showHeaders, setShowHeaders] = useState(false)
  const [rows, setRows] = useState<HeaderRow[]>([{ name: "", value: "" }])
  const [remember, setRemember] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  // The verdict, and the URL it is about — the input may have moved on since.
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null)
  const [failedUrl, setFailedUrl] = useState("")
  // Set when a 401 verdict seeds an Authorization row, so focus can follow it
  // into a field that does not exist until the disclosure has opened.
  const [seedingAuth, setSeedingAuth] = useState(false)
  const headersRef = useRef<HTMLDivElement>(null)
  const [recents, setRecents] = useState<RecentServer[]>(() => loadRecents())
  // Chosen once per mount, not per render — the headline must not change under
  // the reader mid-visit.
  const [tagline] = useState(pickTagline)
  const autoRan = useRef(false)

  const headersOf = (r: HeaderRow[]) =>
    Object.fromEntries(r.filter((h) => h.name.trim() !== "").map((h) => [h.name.trim(), h.value]))

  async function connectTo(target: string, headers: Record<string, string>, persist: Record<string, string> | undefined) {
    setBusy(true)
    setError(null)
    setDiagnosis(null)
    setFailedUrl(target)
    // Held rather than returned from the catch, because the probe below must
    // run after the form has been re-enabled — a `return` there would skip it.
    let failure: { error: unknown } | null = null
    try {
      const conn = await connectUrlFn(target, headers)
      setRecents(saveRecent({ url: target, headers: persist }))
      onConnected(conn, { url: target })
    } catch (err) {
      failure = { error: err }
    } finally {
      setBusy(false)
    }
    if (failure === null) return

    setError(failure.error)
    const env = { pageUrl: window.location.href, online: navigator.onLine }
    const verdict = diagnose(target, failure.error, env)
    if (!wantsProbe(verdict)) {
      setDiagnosis(verdict)
      return
    }
    // Nothing readable came back. One `no-cors` request settles whether the
    // host answered at all, which is the difference between naming CORS as a
    // fact and hedging (spec §4).
    setDiagnosis({ kind: "probing" })
    const probe = await probeFn(target)
    setDiagnosis(diagnose(target, failure.error, { ...env, probe }))
  }

  /**
   * The 401 verdict's action. It opens the disclosure and seeds the row; it
   * never submits — the visitor still has to paste the token and press Connect.
   */
  function addAuthHeader() {
    setShowHeaders(true)
    setRows((current) => {
      if (current.some((r) => r.name.trim().toLowerCase() === "authorization")) return current
      const seeded = { name: "Authorization", value: "Bearer " }
      const blank = current.findIndex((r) => r.name.trim() === "" && r.value.trim() === "")
      return blank === -1 ? [...current, seeded] : current.map((r, i) => (i === blank ? seeded : r))
    })
    setSeedingAuth(true)
  }

  useEffect(() => {
    if (!seedingAuth || !showHeaders) return
    setSeedingAuth(false)
    const names = headersRef.current?.querySelectorAll<HTMLInputElement>('input[aria-label^="Header name"]')
    const values = headersRef.current?.querySelectorAll<HTMLInputElement>('input[aria-label^="Header value"]')
    if (!names || !values) return
    const seeded = [...names].findIndex((el) => el.value.toLowerCase() === "authorization")
    values[seeded === -1 ? values.length - 1 : seeded]?.focus()
  }, [seedingAuth, showHeaders])

  useEffect(() => {
    if (autoConnect && initialUrl && !autoRan.current) {
      autoRan.current = true
      // A `?server=` link is the same server the visitor may have saved headers
      // for; connecting anonymously made every shared link fail on an auth'd
      // server that works from the recents list (TODO-12). The rows are seeded
      // too, so a failure leaves something to correct rather than an empty box.
      const remembered = loadRecents().find((r) => r.url === initialUrl)?.headers
      if (remembered) {
        setRows(Object.entries(remembered).map(([name, value]) => ({ name, value })))
        setRemember(true)
      }
      void connectTo(initialUrl, remembered ?? {}, remembered)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleDemo() {
    setBusy(true)
    setError(null)
    setDiagnosis(null)
    try {
      onConnected(await connectDemoFn(), {})
    } catch (err) {
      // The in-page server touches no network, so there is nothing to diagnose:
      // whatever it says is the whole story.
      setError(err)
      setDiagnosis({ kind: "other", message: err instanceof Error ? err.message : String(err) })
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
      <h1 className={styles.title}>{tagline}</h1>
      <p className={styles.sub}>Paste a server URL — get a living control deck of its tools, resources and prompts.</p>
      <p className={styles.gloss}>
        MCP is how apps hand tools and data to AI assistants — this shows you what a server offers.
      </p>

      <div className={styles.doors}>
        <section className={`${styles.door} ${styles.connectDoor}`} aria-label="Connect your server">
          <Prism className={styles.doorPrism} />
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
            <div className={styles.headers} ref={headersRef}>
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

          <section className={styles.examples} aria-label="Example servers">
            <p className={styles.microlabel}>TRY ONE</p>
            {EXAMPLE_SERVERS.map((ex) => (
              <button
                key={ex.url}
                type="button"
                className={styles.example}
                title={ex.url}
                disabled={busy}
                onClick={() => void connectTo(ex.url, {}, undefined)}
              >
                <span className={styles.exampleName}>{ex.name}</span>
                <span className={styles.exampleNote}>{ex.note}</span>
              </button>
            ))}
          </section>

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

        <section className={styles.door} aria-label="Explore an offline demo">
          <h2 className={styles.doorTitle}>Explore an offline demo</h2>
          <p className={styles.doorSub}>No setup, no network — a demo server runs entirely in your browser tab.</p>
          <button type="button" className={styles.demo} onClick={() => void handleDemo()} disabled={busy}>
            Explore the demo
          </button>
        </section>
      </div>

      {diagnosis !== null && (
        <ConnectError
          error={error}
          diagnosis={diagnosis}
          url={failedUrl}
          onAddAuthHeader={addAuthHeader}
          onUseHttps={(secure) => {
            setUrl(secure)
            const h = headersOf(rows)
            void connectTo(secure, h, remember ? h : undefined)
          }}
        />
      )}
    </main>
  )
}
