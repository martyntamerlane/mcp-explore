import { useState } from "react"
import { connectUrl as realConnectUrl } from "./mcp/connect"
import type { Connection } from "./mcp/types"
import ConnectScreen from "./ui/ConnectScreen"
import DetailPanel from "./ui/DetailPanel"
import FlowView from "./ui/flow/FlowView"
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

  const { snapshot, transportKind } = phase.connection
  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <span className={styles.serverName}>{snapshot.serverInfo.name}</span>
        <span className={styles.chip}>v{snapshot.serverInfo.version}</span>
        <span className={styles.chip}>{transportKind}</span>
        <span className={styles.counts}>
          {snapshot.tools.length} tools · {snapshot.resources.length} resources · {snapshot.prompts.length} prompts
        </span>
        <button type="button" className={styles.disconnect} onClick={() => void disconnect()}>
          Disconnect
        </button>
      </header>
      <main className={styles.main}>
        <FlowView snapshot={snapshot} transportKind={transportKind} selection={selected} onSelect={setSelected} />
        <DetailPanel connection={phase.connection} selected={selected} onClose={() => setSelected(null)} />
      </main>
    </div>
  )
}
