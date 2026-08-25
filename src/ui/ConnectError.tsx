import { ConnectFailure } from "../mcp/connect"
import styles from "./ConnectError.module.css"

const TRANSPORT_LABEL: Record<string, string> = {
  "streamable-http": "Streamable HTTP",
  sse: "HTTP + SSE (legacy)",
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export default function ConnectError({ error }: { error: unknown }) {
  if (!(error instanceof ConnectFailure)) {
    return (
      <div role="alert" className={styles.box}>
        <p className={styles.headline}>{messageOf(error)}</p>
      </div>
    )
  }
  return (
    <div role="alert" className={styles.box}>
      <p className={styles.headline}>Couldn't reach this server over any supported transport.</p>
      <ul className={styles.attempts}>
        {error.attempts.map((a) => (
          <li key={a.kind}>
            <span className={styles.kind}>{TRANSPORT_LABEL[a.kind] ?? a.kind}</span>
            <span className={styles.msg}>{messageOf(a.error)}</span>
          </li>
        ))}
      </ul>
      <div className={styles.hint}>
        <p>
          Browsers can only reach MCP servers that allow cross-origin requests. If this server is yours, make it send:
        </p>
        <pre className={styles.code}>{`Access-Control-Allow-Origin: *\nAccess-Control-Allow-Headers: *\nAccess-Control-Expose-Headers: mcp-session-id`}</pre>
        <p className={styles.small}>
          Localhost servers may additionally need you to accept the browser's local-network permission prompt.
        </p>
      </div>
      <details className={styles.details}>
        <summary>Technical details</summary>
        <pre className={styles.code}>
          {error.attempts.map((a) => `${a.kind}: ${messageOf(a.error)}`).join("\n")}
        </pre>
      </details>
    </div>
  )
}
