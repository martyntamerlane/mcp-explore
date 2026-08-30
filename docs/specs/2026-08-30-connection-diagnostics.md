# Connection diagnostics — saying only what we know

**Date**: 2026-08-30 · **Status**: built · Fixes **ISSUE-9** · Annotates **TODO-7**
· Supersedes Deliverable 1 of
[`docs/external-sources/HANDOVER-mcp-explore-cors-proxy.md`](../external-sources/HANDOVER-mcp-explore-cors-proxy.md).

The connect-error panel told every failure the same story. A typo'd hostname, a
`401`, a `500`, a URL that was never an MCP server at all — each got the same
paragraph explaining how to configure `Access-Control-Allow-Origin`. The app had
the truth in hand every time and threw it away.

This replaces the hardcoded hint with a **verdict derived from the failure**, and
adds one measurement so the CORS verdict is a statement rather than a guess.

## 1 · Why the proxy was declined

The handover proposed a Cloudflare Worker CORS proxy with a five-host allowlist.
Measured on 2026-08-30 with browser-shaped requests (`Origin`, preflight, then a
real `initialize`):

| Host | Preflight | `Mcp-Session-Id` exposed | Needs a proxy |
|---|---|---|---|
| `mcp.deepwiki.com` | 200, `ACAO: *` | n/a — stateless | no |
| `huggingface.co` | 200, echoes origin | n/a | no |
| `learn.microsoft.com` | 204, `ACAO: *` | **yes** | no |
| `knowledge-mcp.global.api.aws` | 415, no CORS headers at all | — | **yes** |
| `*.myshopify.com` | no CORS headers | — | **yes** |

Three of five need nothing. Of the two that do, Shopify requires the visitor to
already know a shop domain — a poor one-click demo — leaving **one server**,
AWS Knowledge, as the entire yield. And that server has a direct substitute:
Microsoft Learn is the same thing (official vendor documentation search,
anonymous, real `tools/call` results) and connects directly.

A hardcoded allowlist would also not have helped the case the proxy is imagined
for. ISSUE-1 is a visitor's *own* server; an allowlist serves only hosts we
curated, so the fallback would fire and then 403. Making it general instead means
running an open relay: the `Origin` check is one `curl -H` away from useless, so
the Worker becomes an anonymising proxy attributed to this account, sharing a
100k/day free cap with the demos it exists to serve.

**Decision: no proxy.** The zero-backend rule in CLAUDE.md stands unamended, and
the effort went into the failure path instead. TODO-7 stays open with this
measurement recorded, so the decision is documented rather than forgotten.

## 2 · What a browser can and cannot know

Three facts constrain everything below.

**A cross-origin refusal is invisible to JavaScript.** `fetch` rejects with a
bare `TypeError` — no status, no headers, no body — identical to what a dead DNS
name, a refused connection, a bad certificate or an ad blocker produces. The
console prints an explanation; script gets nothing. This is deliberate: telling a
page "that host exists but refused you" would itself be the leak the policy
exists to prevent.

**Reading any status code at all is proof CORS succeeded.** If the browser let us
see `401`, it let us see the response. So an attempt carrying an HTTP status is
positive evidence that cross-origin is *not* the problem — the strongest signal
available, and the one the old panel ignored.

**The preflight response is unreadable.** We can never say *which* header is
missing, only that the request was refused. The panel hands over a known-good set
and does not pretend to have diagnosed the specific gap.

## 3 · The classifier

`src/mcp/diagnose.ts` — pure, no I/O, no globals. Takes the URL, the thrown
error, and an environment record (page URL, `navigator.onLine`, an optional probe
outcome); returns one `Diagnosis`.

Order matters, and it is not the obvious one:

1. **Not a `ConnectFailure`** → `other`. URL parse and scheme errors throw before
   any transport is tried; they already carry their own message.
2. **Any attempt carrying an HTTP status** → `http-status`. Statuses outrank
   opaque failures because a status is evidence and a `TypeError` is absence of
   evidence. `401`/`403`, `404`, `405` and `5xx` each get their own sentence.
3. **Any attempt reporting an unexpected content type** → `not-mcp`. The SDK
   raises this with `code: -1`, which also means a response arrived, so CORS is
   fine and the URL simply isn't an MCP endpoint.
4. Everything below here is a network-level failure with nothing readable:
   1. **Private or loopback host, from a page that is not itself local** →
      `private-host`. Checked *before* mixed content, because `http://localhost`
      is a potentially-trustworthy URL and therefore not mixed content at all —
      what actually blocks it is Private Network Access.
   2. **`http:` target from an `https:` page** → `mixed-content`. Certain from
      the URL alone; no request was ever sent.
   3. **`navigator.onLine === false`** → `offline`.
   4. **Probe outcome** → `cors-refused` / `unreachable` / `opaque`.

**A failure after the handshake is never a CORS story.** `ConnectFailure.attempts`
carry `phase: "connect" | "snapshot"` (TODO-9, delivered with this work). An
attempt that reached the snapshot had already completed the handshake, so the
transport and the browser's cross-origin checks are both proven fine; the
`listing` verdict says so and no probe runs, because a probe would be measuring
something already known.

**A readable status is not the same as a refusal.** Only `>= 400` is the server
saying no. A `2xx`/`3xx` that still ended in a connect failure means a response
arrived cleanly and simply wasn't MCP, so it falls through to `not-mcp`. This was
found only in a browser (ISSUE-10): `raw.githubusercontent.com` produced *"The
server refused the request (HTTP 200)"*, because the legacy SSE transport carries
the real status alongside its own wording for a wrong content type — "Invalid
content type", where the Streamable HTTP transport says "Unexpected content
type". Matching one phrasing and not the other let the 200 reach the status
branch. Both phrasings are matched now.

### Status extraction

`statusOf` duck-types rather than importing SDK error classes: a numeric `code`
in `100..599` is the status. The legacy SSE transport throws a plain `Error` with
the status only in its message, so there is a documented regex fallback for
`(HTTP nnn)`. Message text is **never** used to classify a network failure —
Chrome says "Failed to fetch", Firefox "NetworkError when attempting to fetch
resource", Safari "Load failed", and any of the three is a valid opaque rejection.

## 4 · The probe

When and only when the diagnosis is otherwise `opaque`, the app sends one extra
request:

```js
fetch(url, { mode: "no-cors", method: "GET", cache: "no-store", signal })
```

A `no-cors` request *is* sent — it is how `<img>` and `<script>` reach other
origins — and returns an opaque response: status 0, nothing readable. Useless for
data, decisive for diagnosis:

- **resolves** → DNS, TCP and TLS all completed and the host answered. The only
  thing that failed on the real attempt was the cross-origin check ⇒
  `cors-refused`, stated as fact.
- **rejects** → the failure is below CORS entirely ⇒ `unreachable`, and CORS is
  not mentioned at all.
- **aborts at 5s** → `inconclusive`, and the verdict stays `opaque` with wording
  that names both possibilities. A slow server must not be reported as silent.

One request, only on a connection that has already failed, and only when it will
change what the panel says.

## 5 · The panel

**One verdict**, not a list of attempts. The two transports almost always fail
for the same reason, so printing both made one problem look like two, and the
retry order is information about *us* rather than about the server. Raw
per-transport messages keep their existing "Technical details" `<details>`.

The verdict comes from the most informative attempt: a status outranks a content
type, which outranks an opaque failure.

**Two verdicts act, rather than only explaining.** These are the cases we know
with certainty and where the control is already on screen:

- `401`/`403` opens the collapsed "Add headers" disclosure and seeds a row with
  `Authorization` / `Bearer `, focused and ready to paste into. Nothing is
  submitted — the form is opened, never sent.
- `mixed-content` offers the `https://` twin as a one-click retry.

Classification stays pure in `diagnose.ts`; only the wiring lives in the
component, which receives the two actions as callbacks.

## 6 · What the CORS verdict hands over

The old snippet was wrong. `Access-Control-Allow-Headers: *` does **not** cover
`Authorization` — the Fetch spec excludes it from the wildcard — so an operator
with an auth'd server who copied our advice stayed broken and had no reason to
suspect us. The replacement lists headers by name and says the preflight must
answer 2xx.

`Access-Control-Expose-Headers: Mcp-Session-Id` is the line most likely to be
dropped for brevity and the one that must not be. Without it a server appears to
connect and then fails on the first request after `initialize`, because the seven
CORS-safelisted response headers are all JavaScript may read and the session id
is not among them.

Alongside it, a copyable `curl` that performs the `initialize` handshake against
the entered URL — so the operator can confirm in one paste that their server is
fine and the browser is the only thing refusing. It is the exact command used to
establish that AWS Knowledge works and simply sends no headers.

**The `curl` never contains a header the visitor typed.** Rendering someone's
bearer token as selectable text — screenshottable into a bug report, pasteable
into a chat — is a needless exposure. It carries a `YOUR_TOKEN` placeholder and a
line saying, plainly, that the real one was deliberately left out.

## 7 · Verdicts

| Kind | Says | Acts |
|---|---|---|
| `http-status` 401/403 | requires credentials; cross-origin is working | opens the headers box |
| `http-status` 404 | reached the host, nothing MCP at this path | — |
| `http-status` 405 | reached the host, both transports rejected | — |
| `http-status` 5xx | the server's own error; nothing wrong on this side | — |
| `not-mcp` | that URL answered, but it is not an MCP endpoint | — |
| `listing` | connected, then failed while listing what it offers | — |
| `cors-refused` | it is running and it answered — it does not permit browsers | snippet + `curl` |
| `unreachable` | no response at all; check the hostname or whether it is running | — |
| `opaque` | the probe was inconclusive; names both possibilities | snippet + `curl` |
| `private-host` | local address from a public page (Private Network Access) | — |
| `mixed-content` | an HTTPS page cannot call `http://` | offers the `https://` twin |
| `offline` | the browser reports no network | — |
| `other` | the error's own message | — |

## 8 · Microsoft Learn joins the examples

`https://learn.microsoft.com/api/mcp`, verified 2026-08-30 to the bar
`examples.ts` already sets: preflight 204 with `ACAO: *`,
`Access-Control-Expose-Headers: WWW-Authenticate,mcp-session-id` (the header most
servers get wrong), and an anonymous `microsoft_docs_search` returning real
documentation: three tools, no auth, no infrastructure. It is the substitute that
made declining the proxy cost nothing.

Measured live rather than assumed: it *declares* resources and prompts
capabilities but lists none of either, so it connects as a tools-only server. An
earlier draft of this section claimed it lit up all three browse segments, which
the browser pass disproved.

## 9 · Hardening delivered alongside

The classifier is the consumer TODO-9 was waiting for, so the rest of that entry
landed here rather than being deferred again:

- **`listAll` is bounded.** `MAX_PAGES` (100) plus repeated-cursor detection.
  Pagination is driven by a cursor the *server* chooses, and the server is
  untrusted: one returning the same cursor forever — or a fresh one forever —
  spun the loop until the tab died. Stopping early keeps the pages already
  fetched, because a partial list beats an empty one and beats a hung tab.
- **`connectDemo`'s `close()` is `try`/`finally`**, so a failing client close
  cannot leak the server side.

And two from TODO-12, both in the same files:

- **A `?server=` link reuses headers remembered for that same server.** It
  connected anonymously before, so a shared link failed against an auth'd server
  that worked perfectly from the recents list one click away. The header rows are
  seeded too, so a failure leaves something to correct rather than an empty box.
  Headers are matched by exact URL — a link never borrows another server's.
- **`loadRecents` validates shapes, not just presence.** `url` was checked;
  `headers` and `lastUsed` were not. localStorage is user-editable and shared
  with anything else on the origin, so a header value that is not a string would
  have been sent to the user's own server or thrown at the render as an object.
  String-valued pairs are kept and the rest dropped, because a usable server URL
  is worth more than one malformed header.

Plus one from the same entry that is not connection-related but is the same class
of bug — untrusted server data rendered without narrowing: **non-string `enum`
members** were passed through `String()`, so an object member displayed as the
literal text `[object Object]`. They are `JSON.stringify`d now, and the chips are
keyed by index because two members can stringify to the same text and a duplicate
React key silently drops one.
