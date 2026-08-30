import type { ProbeOutcome } from "./diagnose"

/**
 * The one measurement that turns "probably CORS" into "CORS".
 *
 * A `no-cors` request is genuinely sent — it is how `<img>` and `<script>`
 * reach other origins — and returns an opaque response: status 0, no readable
 * headers or body. Useless for data, decisive for diagnosis:
 *
 *   resolves → DNS, TCP and TLS all completed and the host answered, so the
 *              only thing that failed on the real attempt was the cross-origin
 *              check.
 *   rejects  → the failure is below CORS entirely; the host never answered.
 *   aborts   → inconclusive. A slow server must not be reported as silent.
 *
 * `fetch` resolves as soon as the response head arrives, so an endpoint that
 * holds an SSE stream open does not delay this; the abort closes it.
 */
export async function probeReachable(rawUrl: string, timeoutMs = 5000): Promise<ProbeOutcome> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    await fetch(rawUrl, {
      mode: "no-cors",
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    })
    return "answered"
  } catch {
    return controller.signal.aborted ? "inconclusive" : "silent"
  } finally {
    clearTimeout(timer)
  }
}
