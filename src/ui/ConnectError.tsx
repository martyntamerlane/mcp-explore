import type { ReactNode } from "react"
import { useState } from "react"
import { ConnectFailure } from "../mcp/connect"
import { messageOf, type Diagnosis } from "../mcp/diagnose"
import styles from "./ConnectError.module.css"

const TRANSPORT_LABEL: Record<string, string> = {
  "streamable-http": "Streamable HTTP",
  sse: "HTTP + SSE (legacy)",
}

/**
 * The headers a server must send for a browser to reach it. Listed by name
 * rather than with `*`, because the Fetch spec excludes `Authorization` from
 * the `Access-Control-Allow-Headers` wildcard — the old advice left anyone with
 * an auth'd server broken with no reason to suspect us.
 */
const CORS_HEADERS = `Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Accept, Authorization,
                              Mcp-Session-Id, MCP-Protocol-Version, Last-Event-ID
Access-Control-Expose-Headers: Mcp-Session-Id`

/**
 * POSIX single-quoting. Inside single quotes a shell expands nothing at all —
 * no `$(…)`, no backticks, no `;` or `|` — and the one character that cannot
 * appear there, `'`, is closed, escaped and reopened.
 */
function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`
}

/**
 * The handshake, as a command the operator can paste. It proves their server
 * works and that the browser is the only thing refusing.
 *
 * It deliberately carries a placeholder rather than any header the visitor
 * typed: a bearer token rendered as selectable text is one screenshot away from
 * a bug report.
 *
 * The URL is normalised and quoted before it goes anywhere near a command line
 * (ISSUE-11). It arrives as the raw string that was typed — or that a `?server=`
 * link supplied — and `new URL()` accepts plenty a shell would act on:
 * `https://host/$(command)` is a valid URL whose `$(…)` runs when pasted, inside
 * double quotes as readily as outside them. `href` percent-encodes some of that
 * and the single quotes neutralise the rest; neither alone is enough.
 */
export function initializeCurl(url: string): string {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "mcp-explore", version: "0.1.0" } },
  })
  // A URL too malformed to parse still gets quoted — it just isn't normalised.
  let target: string
  try {
    target = new URL(url).href
  } catch {
    target = url
  }
  return `curl -i -X POST ${shellQuote(target)} \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '${body}'`
}

function statusCopy(status: number): { headline: string; body: string } {
  if (status === 401 || status === 403)
    return {
      headline: `This server requires credentials (HTTP ${status}).`,
      body: "It answered your browser correctly, so cross-origin requests work here — it just won't serve this endpoint without an Authorization header.",
    }
  if (status === 404)
    return {
      headline: "Reached the server, but there's nothing MCP at this path (HTTP 404).",
      body: "The host answered, so the connection itself is fine. Check the path — servers commonly expose MCP at /mcp or /sse.",
    }
  if (status === 405)
    return {
      headline: "Reached the server, but it rejected both transports (HTTP 405).",
      body: "The host answered and refused the methods MCP needs. It may expect a different path, or may not be an MCP endpoint at all.",
    }
  if (status >= 500)
    return {
      headline: `The server hit an error of its own (HTTP ${status}).`,
      body: "The request arrived and the server failed to handle it. Nothing is wrong on this side — try again, or check the server's logs.",
    }
  return {
    headline: `The server refused the request (HTTP ${status}).`,
    body: "It answered, so the connection and the cross-origin checks are both working; the request itself was rejected.",
  }
}

function CopyableCode({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className={styles.snippet}>
      <div className={styles.snippetHead}>
        <span className={styles.snippetLabel}>{label}</span>
        <button
          type="button"
          className={styles.copy}
          onClick={() => {
            void navigator.clipboard?.writeText(text)
            setCopied(true)
            setTimeout(() => setCopied(false), 1600)
          }}
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <pre className={styles.code}>{text}</pre>
    </div>
  )
}

/** Snippet + handshake command — shared by the certain and the hedged CORS verdicts. */
function CorsRemedy({ url }: { url: string }) {
  return (
    <div className={styles.remedy}>
      <p>
        If this server is yours, it needs to answer the preflight <code>OPTIONS</code> with a 2xx and send:
      </p>
      <CopyableCode label="response headers" text={CORS_HEADERS} />
      <p className={styles.small}>
        <code>Access-Control-Expose-Headers</code> is the one most often left out. Without it a server appears to
        connect and then fails on the first request after <code>initialize</code>, because JavaScript may read only
        seven safelisted response headers and the session id is not one of them.
      </p>
      <p>To confirm the server itself is fine and only the browser is refusing:</p>
      <CopyableCode label="handshake" text={initializeCurl(url)} />
      <p className={styles.small}>
        Add <code>-H "Authorization: Bearer YOUR_TOKEN"</code> if your server needs one — any token you entered above
        is deliberately left out of this command rather than printed on screen.
      </p>
    </div>
  )
}

export interface ConnectErrorProps {
  error: unknown
  diagnosis: Diagnosis
  /** The URL as entered, for the handshake command and the https:// retry. */
  url: string
  /** Opens the headers disclosure and seeds an Authorization row. */
  onAddAuthHeader?: () => void
  /** Retries against the https:// twin of a mixed-content target. */
  onUseHttps?: (secureUrl: string) => void
}

export default function ConnectError({ error, diagnosis, url, onAddAuthHeader, onUseHttps }: ConnectErrorProps) {
  let headline: string
  let body: ReactNode = null
  let action: ReactNode = null

  switch (diagnosis.kind) {
    case "probing":
      headline = "Couldn't connect."
      body = <p>Checking whether the server answered at all…</p>
      break
    case "other":
      headline = diagnosis.message
      break
    case "http-status": {
      const copy = statusCopy(diagnosis.status)
      headline = copy.headline
      body = <p>{copy.body}</p>
      if (diagnosis.status === 401 || diagnosis.status === 403) {
        action = (
          <button type="button" className={styles.action} onClick={onAddAuthHeader}>
            Add an Authorization header
          </button>
        )
      }
      break
    }
    case "not-mcp":
      headline = "That URL answered, but it isn't an MCP endpoint."
      body = (
        <p>
          The host replied with something the MCP client couldn't read — often a web page rather than a protocol
          endpoint. Cross-origin requests are working; the address is the problem.
        </p>
      )
      break
    case "listing":
      headline = "Connected, then failed while listing what the server offers."
      body = (
        <p>
          The handshake succeeded, so the transport and the browser's cross-origin checks are both fine. The failure
          came afterwards, while fetching the server's tools, resources or prompts.
        </p>
      )
      break
    case "private-host":
      headline = `${diagnosis.host} is on your own machine or local network.`
      body = (
        <p>
          This page is served from the public web, so your browser restricts requests to local addresses (Private
          Network Access). Chrome may show a permission prompt; other browsers refuse outright. Running mcp-explore
          locally avoids this entirely.
        </p>
      )
      break
    case "mixed-content":
      headline = "This page is served over HTTPS, so it can't call an http:// address."
      body = <p>Browsers block insecure requests from a secure page. If the server also answers on HTTPS, use that.</p>
      action = (
        <button type="button" className={styles.action} onClick={() => onUseHttps?.(diagnosis.secureUrl)}>
          Try {diagnosis.secureUrl}
        </button>
      )
      break
    case "offline":
      headline = "Your browser reports no network connection."
      body = <p>Nothing was sent. Reconnect and try again.</p>
      break
    case "cors-refused":
      headline = "This server doesn't allow browsers to read its responses."
      body = (
        <>
          <p>
            {diagnosis.host} is running and it answered — that was checked separately. But it doesn't send the CORS
            headers a browser requires, so the response was blocked before this page could read it. No browser-based
            client can connect to it; a command-line client can.
          </p>
          <CorsRemedy url={url} />
        </>
      )
      break
    case "unreachable":
      headline = `Couldn't reach ${diagnosis.host} at all.`
      body = (
        <p>
          No response came back — the request didn't complete at the network level. Check the hostname for typos,
          whether the server is running, and whether anything local (a VPN, a firewall, an ad blocker) is intercepting
          it.
        </p>
      )
      break
    case "opaque":
      headline = `Couldn't get a response from ${diagnosis.host}.`
      body = (
        <>
          <p>
            The browser blocked the request before this page could see anything, and the follow-up check timed out —
            so this is either a server that refuses cross-origin requests, or one that isn't answering. Both look
            identical from inside a browser.
          </p>
          <CorsRemedy url={url} />
        </>
      )
      break
  }

  return (
    <div role="alert" className={styles.box}>
      <p className={styles.headline}>{headline}</p>
      <div className={styles.hint}>{body}</div>
      {action}
      {error instanceof ConnectFailure && (
        <details className={styles.details}>
          <summary>Technical details</summary>
          <pre className={styles.code}>
            {error.attempts
              .map((a) => `${TRANSPORT_LABEL[a.kind] ?? a.kind}: ${messageOf(a.error)}`)
              .join("\n")}
          </pre>
        </details>
      )}
    </div>
  )
}
