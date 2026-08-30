import { ConnectFailure } from "./connect"

/**
 * Turning a connect failure into something true.
 *
 * The panel used to print the same CORS advice for every failure — a typo'd
 * hostname, a 401, a 500 — while the evidence to tell them apart sat unread in
 * `ConnectFailure.attempts` (ISSUE-9). This is that evidence, classified.
 *
 * Pure: no fetch, no globals, no `window`. Everything the environment knows
 * arrives in `DiagnoseEnv`, which is what makes each branch testable.
 * See `docs/specs/2026-08-30-connection-diagnostics.md`.
 */

/** What one `no-cors` probe request established. See `probe.ts`. */
export type ProbeOutcome = "answered" | "silent" | "inconclusive"

export type Diagnosis =
  /** The probe is in flight; the panel says so rather than guessing early. */
  | { kind: "probing" }
  /** Thrown before any transport was tried (bad URL, unsupported scheme). */
  | { kind: "other"; message: string }
  /** A status came back, so the browser let us read the response: CORS is fine. */
  | { kind: "http-status"; status: number; detail: string }
  /** A response arrived and wasn't MCP — again, proof CORS is fine. */
  | { kind: "not-mcp"; detail: string }
  /** The handshake succeeded and listing failed afterwards. Never a CORS story. */
  | { kind: "listing"; detail: string }
  | { kind: "private-host"; host: string }
  | { kind: "mixed-content"; secureUrl: string }
  | { kind: "offline" }
  /** The probe answered: the host is up, so the cross-origin check is what failed. */
  | { kind: "cors-refused"; host: string }
  /** The probe was refused too: the failure is below CORS entirely. */
  | { kind: "unreachable"; host: string }
  /** Nothing readable and no usable probe — both possibilities stay named. */
  | { kind: "opaque"; host: string }

export interface DiagnoseEnv {
  /** `window.location.href` — the page's own origin decides two of the branches. */
  pageUrl: string
  online: boolean
  probe?: ProbeOutcome
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * The legacy SSE transport throws a plain `Error` with the status only in its
 * text, so the duck-typed `code` (which `StreamableHTTPError` carries) needs a
 * documented fallback. Note this reads the SDK's *own* message, never a
 * browser's: network-failure text differs per engine ("Failed to fetch",
 * "NetworkError when attempting to fetch resource", "Load failed") and is
 * never used to classify anything.
 */
const HTTP_IN_MESSAGE = /\bHTTP (\d{3})\b/

export function statusOf(error: unknown): number | undefined {
  const code = (error as { code?: unknown } | null | undefined)?.code
  if (typeof code === "number" && code >= 100 && code <= 599) return code
  const found = HTTP_IN_MESSAGE.exec(messageOf(error))
  if (found) {
    const status = Number(found[1])
    if (status >= 100 && status <= 599) return status
  }
  return undefined
}

/**
 * A response arrived and the client couldn't read it as MCP.
 *
 * The two transports word this differently and neither is a refusal:
 * `StreamableHTTPError` uses `code: -1` and "Unexpected content type", while
 * `SseError` carries the real status (a 200, typically) and says "Invalid
 * content type". Matching only the first phrasing let a 200 fall through to
 * the status branch and be reported as the server refusing (ISSUE-10).
 */
function isContentTypeFailure(error: unknown): boolean {
  const code = (error as { code?: unknown } | null | undefined)?.code
  return code === -1 || /(unexpected|invalid) content type/i.test(messageOf(error))
}

/**
 * Loopback, link-local and RFC1918. `.local` is mDNS. Bracketed IPv6 literals
 * arrive from `URL.hostname` already unbracketed, but the strip is cheap.
 */
export function isLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "")
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true
  if (host === "::1" || host === "0.0.0.0") return true
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return true
  if (/^169\.254\./.test(host)) return true
  const block = /^172\.(\d{1,3})\./.exec(host)
  return block !== null && Number(block[1]) >= 16 && Number(block[1]) <= 31
}

export function diagnose(rawUrl: string, error: unknown, env: DiagnoseEnv): Diagnosis {
  // Nothing was ever sent — URL parsing and the scheme check throw before the
  // transports run, and those errors already say what is wrong.
  if (!(error instanceof ConnectFailure)) return { kind: "other", message: messageOf(error) }

  // A status of 400 or more is the server refusing — and any readable status
  // at all is proof the browser let us see the response, which makes it the
  // strongest signal available and outranks every opaque failure.
  const refusal = error.attempts
    .map((attempt) => ({ attempt, status: statusOf(attempt.error) }))
    .find(({ status }) => status !== undefined && status >= 400)
  if (refusal?.status !== undefined) {
    return { kind: "http-status", status: refusal.status, detail: messageOf(refusal.attempt.error) }
  }

  // A response that arrived *successfully* and still failed the handshake is a
  // URL that isn't an MCP endpoint. Reporting its 200 as a refusal read as
  // nonsense ("the server refused the request (HTTP 200)") — ISSUE-10.
  const arrived = error.attempts.find(
    (attempt) => isContentTypeFailure(attempt.error) || statusOf(attempt.error) !== undefined,
  )
  if (arrived) return { kind: "not-mcp", detail: messageOf(arrived.error) }

  // Reached only when nothing readable came back — but an attempt that got as
  // far as the snapshot had already completed the handshake, so the transport
  // and the browser's cross-origin checks are both proven fine and no amount of
  // probing below would be about the right thing.
  const listed = error.attempts.find((attempt) => attempt.phase === "snapshot")
  if (listed) return { kind: "listing", detail: messageOf(listed.error) }

  let target: URL
  try {
    target = new URL(rawUrl)
  } catch {
    return { kind: "other", message: messageOf(error) }
  }
  const page = new URL(env.pageUrl)

  // Before mixed content, deliberately: `http://localhost` is a
  // potentially-trustworthy URL and therefore not mixed content at all. What
  // actually blocks it from a hosted page is Private Network Access.
  if (isLocalHostname(target.hostname) && !isLocalHostname(page.hostname)) {
    return { kind: "private-host", host: target.host }
  }
  if (page.protocol === "https:" && target.protocol === "http:") {
    const secure = new URL(target.href)
    secure.protocol = "https:"
    return { kind: "mixed-content", secureUrl: secure.href }
  }
  if (!env.online) return { kind: "offline" }

  if (env.probe === "answered") return { kind: "cors-refused", host: target.host }
  if (env.probe === "silent") return { kind: "unreachable", host: target.host }
  // No probe yet, or one that timed out: name both possibilities.
  return { kind: "opaque", host: target.host }
}

/** True while one extra request could still turn a guess into a statement. */
export function wantsProbe(diagnosis: Diagnosis): boolean {
  return diagnosis.kind === "opaque"
}
