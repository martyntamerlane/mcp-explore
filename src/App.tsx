import { useState } from "react"
import { connectUrl as realConnectUrl } from "./mcp/connect"
import type { Connection } from "./mcp/types"
import ConnectScreen from "./ui/ConnectScreen"
import DetailPanel from "./ui/DetailPanel"
import DeckView from "./ui/deck/DeckView"
import Prism from "./ui/deck/Prism"
import { RunProvider } from "./ui/run/RunContext"
import type { EntitySelection } from "./ui/stage"
import styles from "./App.module.css"

type Phase = { status: "idle" } | { status: "connected"; connection: Connection }

export default function App({ connectUrlFn = realConnectUrl }: { connectUrlFn?: typeof realConnectUrl } = {}) {
  const [phase, setPhase] = useState<Phase>({ status: "idle" })
  const [selected, setSelected] = useState<EntitySelection | null>(null)
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

  // Server identity lives in the deck boundary (the multi-server seam);
  // app chrome carries only the brand and the session action.
  const { snapshot, transportKind } = phase.connection
  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <Prism className={styles.brandMark} />
        <span className={styles.brand}>MCP EXPLORE</span>
        <button type="button" className={styles.disconnect} onClick={() => void disconnect()}>
          Disconnect
        </button>
      </header>
      <main className={styles.main}>
        <RunProvider connection={phase.connection}>
          <DeckView snapshot={snapshot} transportKind={transportKind} selection={selected} onSelect={setSelected} />
          <DetailPanel connection={phase.connection} selected={selected} onClose={() => setSelected(null)} />
        </RunProvider>
      </main>
    </div>
  )
}
