import { useState } from "react"
import { connectDemo } from "./mcp/connect"
import type { Connection } from "./mcp/types"
import styles from "./App.module.css"

type Phase =
  | { status: "idle" }
  | { status: "connecting" }
  | { status: "connected"; connection: Connection }
  | { status: "error"; message: string }

// Placeholder proof harness: exercises the connection layer end to end.
// The real landing + graph UI (next plan) replaces this component entirely.
export default function App() {
  const [phase, setPhase] = useState<Phase>({ status: "idle" })

  async function handleDemo() {
    setPhase({ status: "connecting" })
    try {
      setPhase({ status: "connected", connection: await connectDemo() })
    } catch (err) {
      setPhase({ status: "error", message: err instanceof Error ? err.message : String(err) })
    }
  }

  return (
    <main className={styles.app}>
      <h1>mcp-explore</h1>
      {phase.status !== "connected" && (
        <button onClick={handleDemo} disabled={phase.status === "connecting"}>
          Try the demo
        </button>
      )}
      {phase.status === "connecting" && <p>Connecting…</p>}
      {phase.status === "error" && <p role="alert">{phase.message}</p>}
      {phase.status === "connected" && <Catalog connection={phase.connection} />}
    </main>
  )
}

function Catalog({ connection }: { connection: Connection }) {
  const { snapshot, transportKind } = connection
  return (
    <section>
      <h2>
        {snapshot.serverInfo.name} <small>v{snapshot.serverInfo.version}</small>
      </h2>
      <p className={styles.muted}>
        via {transportKind} · {snapshot.tools.length} tools · {snapshot.resources.length} resources ·{" "}
        {snapshot.prompts.length} prompts
      </p>
      <h3>Tools</h3>
      <ul>
        {snapshot.tools.map((t) => (
          <li key={t.name}>{t.name}</li>
        ))}
      </ul>
      <h3>Resources</h3>
      <ul>
        {snapshot.resources.map((r) => (
          <li key={r.uri}>{r.uri}</li>
        ))}
      </ul>
      <h3>Prompts</h3>
      <ul>
        {snapshot.prompts.map((p) => (
          <li key={p.name}>{p.name}</li>
        ))}
      </ul>
    </section>
  )
}
