import { useState } from "react"
import { connectUrl as realConnectUrl } from "./mcp/connect"
import type { Connection } from "./mcp/types"
import ChromeBar from "./ui/ChromeBar"
import ConnectScreen from "./ui/ConnectScreen"
import DeckView from "./ui/deck/DeckView"
import { ReadProvider } from "./ui/run/ReadContext"
import { RunProvider } from "./ui/run/RunContext"
import type { EntitySelection } from "./ui/stage"
import styles from "./App.module.css"

type Phase = { status: "idle" } | { status: "connected"; connection: Connection }

export default function App({ connectUrlFn = realConnectUrl }: { connectUrlFn?: typeof realConnectUrl } = {}) {
  const [phase, setPhase] = useState<Phase>({ status: "idle" })
  const [selected, setSelected] = useState<EntitySelection | null>(null)
  const [query, setQuery] = useState("")
  const [autoTarget, setAutoTarget] = useState<string | undefined>(
    () => new URLSearchParams(window.location.search).get("server") ?? undefined,
  )

  function handleConnected(connection: Connection, source: { url?: string }) {
    if (source.url) {
      window.history.replaceState(null, "", "?server=" + encodeURIComponent(source.url))
    } else {
      window.history.replaceState(null, "", window.location.pathname)
    }
    setAutoTarget(undefined)
    setSelected(null)
    setQuery("")
    setPhase({ status: "connected", connection })
  }

  async function disconnect() {
    if (phase.status === "connected") {
      await phase.connection.close().catch(() => {})
    }
    window.history.replaceState(null, "", window.location.pathname)
    setSelected(null)
    setPhase({ status: "idle" })
  }

  if (phase.status === "idle") {
    return (
      <ConnectScreen
        onConnected={handleConnected}
        initialUrl={autoTarget}
        autoConnect={autoTarget !== undefined}
        connectUrlFn={connectUrlFn}
      />
    )
  }

  // One chrome band carries brand, server identity and the filter; the stage
  // below it is nothing but browse column + workspace (spec §3.1).
  const { snapshot, transportKind } = phase.connection
  return (
    <div className={styles.app}>
      <ChromeBar
        snapshot={snapshot}
        transportKind={transportKind}
        query={query}
        onQuery={setQuery}
        onDisconnect={() => void disconnect()}
      />
      <main className={styles.main}>
        <RunProvider connection={phase.connection}>
          <ReadProvider connection={phase.connection}>
            <DeckView
              snapshot={snapshot}
              transportKind={transportKind}
              selection={selected}
              onSelect={setSelected}
              query={query}
            />
          </ReadProvider>
        </RunProvider>
      </main>
    </div>
  )
}
