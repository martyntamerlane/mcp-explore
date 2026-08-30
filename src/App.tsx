import { useEffect, useRef, useState } from "react"
import { connectUrl as realConnectUrl } from "./mcp/connect"
import type { Connection } from "./mcp/types"
import ChromeBar from "./ui/ChromeBar"
import ConnectScreen from "./ui/ConnectScreen"
import DeckView from "./ui/deck/DeckView"
import { RawViewProvider } from "./ui/deck/rawView"
import { ModeProvider } from "./ui/ModeContext"
import { ReadProvider } from "./ui/run/ReadContext"
import { RunProvider } from "./ui/run/RunContext"
import { parseSelection, readParams, resolveSelection, sameSelection, selectionParams } from "./ui/selectionUrl"
import type { EntitySelection } from "./ui/stage"
import styles from "./App.module.css"

type Phase = { status: "idle" } | { status: "connected"; connection: Connection }

export default function App({ connectUrlFn = realConnectUrl }: { connectUrlFn?: typeof realConnectUrl } = {}) {
  const [phase, setPhase] = useState<Phase>({ status: "idle" })
  const [selected, setSelected] = useState<EntitySelection | null>(null)
  const [serverUrl, setServerUrl] = useState<string | undefined>(undefined)
  const [query, setQuery] = useState("")
  const [autoTarget, setAutoTarget] = useState<string | undefined>(
    () => new URLSearchParams(readParams(window.location)).get("server") ?? undefined,
  )
  const filterRef = useRef<HTMLInputElement>(null)

  /**
   * The address bar is the selection's home (TODO-25). `pushState` for a
   * user-initiated selection — that is what gives Back/Forward a history to
   * walk — and `replaceState` for anything the app decided on its own, so
   * connecting never buries the page the visitor arrived from.
   *
   * Written to the **fragment** (TODO-31): a query string is sent to GitHub
   * Pages in the request for the document itself, so a shared link handed the
   * address of someone's MCP server to our host. A fragment never leaves the
   * browser. `readParams` still reads `?server=` for links shared before this.
   *
   * The whole relative URL is rebuilt rather than passing a bare `"#…"`, which
   * resolves against the current URL and would *keep* an existing query string —
   * so a visitor arriving on a legacy `?server=` link would end up carrying both.
   */
  const writeUrl = (url: string | undefined, selection: EntitySelection | null, mode: "push" | "replace") => {
    const params = selectionParams(url, selection)
    const next = window.location.pathname + (params === "" ? "" : "#" + params)
    if (mode === "push") window.history.pushState(null, "", next)
    else window.history.replaceState(null, "", next)
  }

  function handleConnected(connection: Connection, source: { url?: string }) {
    // A deep link's selection only applies to the server it was written for,
    // and only if that server still exposes it.
    const arrived = readParams(window.location)
    const params = new URLSearchParams(arrived)
    const linked =
      source.url !== undefined && params.get("server") === source.url
        ? resolveSelection(parseSelection(arrived), connection.snapshot)
        : null
    writeUrl(source.url, linked, "replace")
    setServerUrl(source.url)
    setAutoTarget(undefined)
    setSelected(linked)
    setQuery("")
    setPhase({ status: "connected", connection })
  }

  function select(next: EntitySelection | null) {
    // Re-selecting the current subject is how a zero-argument tool is re-run;
    // it is not a new place, so it must not push a duplicate history entry.
    if (sameSelection(next, selected)) return
    setSelected(next)
    writeUrl(serverUrl, next, "push")
  }

  // Back/Forward move the selection; the URL is the source of truth, and this
  // path never writes history back or the two would chase each other.
  useEffect(() => {
    if (phase.status !== "connected") return
    const { snapshot } = phase.connection
    const onPop = () => setSelected(resolveSelection(parseSelection(readParams(window.location)), snapshot))
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [phase])

  async function disconnect() {
    if (phase.status === "connected") {
      await phase.connection.close().catch(() => {})
    }
    window.history.replaceState(null, "", window.location.pathname)
    setSelected(null)
    setServerUrl(undefined)
    setPhase({ status: "idle" })
  }

  /**
   * The link to the current selection is the address bar, verbatim: S1 already
   * keeps the URL in step with what is on screen, so there is nothing to
   * rebuild here and no way for the copied link to disagree with the page.
   */
  function copyLink() {
    void navigator.clipboard?.writeText(window.location.href)
  }

  if (phase.status === "idle") {
    return (
      <ModeProvider>
        <ConnectScreen
          onConnected={handleConnected}
          initialUrl={autoTarget}
          autoConnect={autoTarget !== undefined}
          connectUrlFn={connectUrlFn}
        />
      </ModeProvider>
    )
  }

  // One chrome band carries brand, server identity and the filter; the stage
  // below it is nothing but browse column + workspace (spec §3.1).
  const { snapshot, transportKind } = phase.connection
  return (
    <ModeProvider>
      <div className={styles.app}>
        <ChromeBar
          snapshot={snapshot}
          transportKind={transportKind}
          query={query}
          onQuery={setQuery}
          filterRef={filterRef}
          onDisconnect={() => void disconnect()}
        />
        <main className={styles.main}>
          <RunProvider connection={phase.connection}>
            <ReadProvider connection={phase.connection}>
              <RawViewProvider>
                <DeckView
                  snapshot={snapshot}
                  transportKind={transportKind}
                  selection={selected}
                  onSelect={select}
                  query={query}
                  onQuery={setQuery}
                  onFocusFilter={() => {
                    filterRef.current?.focus()
                    filterRef.current?.select()
                  }}
                  onCopyLink={copyLink}
                  onDisconnect={() => void disconnect()}
                />
              </RawViewProvider>
            </ReadProvider>
          </RunProvider>
        </main>
      </div>
    </ModeProvider>
  )
}
