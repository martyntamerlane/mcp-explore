# Implementation plan — "it runs on your device": the trust statement, and the one thing that isn't true yet

**Date**: 2026-08-30
**Status**: **§4 (Session A) done 2026-08-30** on `feat/local-execution-trust`. §5 not started — it carries an
unresolved design-approval gate.
**TODO**: [TODO-31](../../TODO.md)
**Complexity**: S

---

## 1. Why

The app's whole architecture is a privacy claim — zero backend, browser-direct, tokens never in URLs
([initial design](../specs/2026-08-24-initial-design.md) decisions #1 and #9) — and the landing page
says none of it. A visitor is asked to paste the address of an internal MCP server, and often a bearer
token beside it, into a page hosted at `martyntamerlane.github.io` with nothing on screen explaining
where any of that goes.

The user asked for two things: copy that explains it, and confirmation that the claim is actually true.

The verification is in §2. It is true, with **one exception** (§3) which this plan closes, because a
trust statement carrying an asterisk is worse than no trust statement.

---

## 2. The verification (done 2026-08-30 — do not re-derive)

Swept `src/` for `fetch` / `XMLHttpRequest` / `sendBeacon` / `WebSocket` / `EventSource` /
`navigator.send*`, for `localStorage` / `sessionStorage` / `document.cookie`, and for every literal
`http(s)://` in the source; read `index.html`, `vite.config.ts` and `.github/workflows/deploy.yml`.

| Finding | Evidence |
| --- | --- |
| **No backend exists.** `deploy.yml` builds `dist/` and uploads it to Pages. There is no server-side code in the repo. | `.github/workflows/deploy.yml` |
| **The only `fetch(` in the codebase targets the address the visitor typed.** | `src/mcp/probe.ts:23` — the `no-cors` reachability probe. Everything else goes through the MCP SDK's transports, also to that address. |
| **No analytics, no telemetry, no third-party scripts, no beacons.** | The sweep returned nothing. `index.html` loads exactly two local module scripts. |
| **The only external URLs in the bundle are five example-server strings.** | `src/ui/examples.ts:20-27` — inert text until a chip is clicked. |
| **Fonts are bundled, not fetched.** Fontsource packages, self-hosted; no Google Fonts request. | `package.json` `@fontsource-variable/*`; CSP `font-src 'self' data:` |
| **Tokens stay on the device.** Custom headers live in `localStorage` and are attached only to requests to the server URL they were saved against; they are never put in a URL. | `src/ui/recents.ts`; `src/mcp/connect.ts` `defaultFactories` |
| **Server responses are never persisted.** Run history is in memory for the session only, deliberately. | `src/ui/run/runHistory.ts:16` |
| **The demo server touches no network at all.** | `src/mcp/connect.ts` `connectDemo` over `InMemoryTransport` |
| **It is enforced, not merely promised.** `script-src 'self' 'unsafe-eval'`, `object-src`/`frame-src`/`form-action`/`base-uri` `'none'`. `connect-src *` is the one open door and it is the product. | `index.html` (ISSUE-14) |
| **⚠ `'unsafe-eval'` is a live caveat, not a footnote.** The SDK's default validator is AJV, which compiles each server-supplied `outputSchema` with `new Function` — so a JSON Schema from an untrusted server becomes executable code in the visitor's browser. `'self'` still blocks the classic vector (nothing external can be loaded or inlined as a script). | `index.html` CSP comment; ISSUE-18; [TODO-33](../../TODO.md) |

**Re-verified 2026-08-30 after PR #8 merged.** Every other row above still holds; only the CSP row
changed, and it changed in a direction the copy has to account for. Re-run the sweep in §2's first
paragraph before Session B ships — the table is only as current as its last check.

---

## 3. The exception: `?server=` reaches GitHub Pages

Selection lives in the **query string** — `?server=https://…&tool=NAME`
([TODO-25](../../TODO.md), [spec](../specs/2026-08-29-addressable-selection.md)). In-session navigation
goes through `pushState`/`replaceState` (`src/App.tsx:33-37`), which issues no request. But **opening a
shared link, or reloading the page, sends `?server=…` to GitHub Pages as part of the HTTP request for
the document itself.** GitHub's edge sees the address of the MCP server being explored.

Scope of the exposure, precisely:

- **Exposed**: the MCP server's URL, and the name of the selected tool/resource/prompt.
- **Not exposed**: tokens and headers (never in URLs, by design), tool arguments, and everything the
  server returns.
- **Not visible to this project**: GitHub does not surface Pages access logs to the repository owner.
  The claim to avoid is "nobody sees it", not "we see it".

Severity is low. It matters here only because it is the single sentence that would make the copy in §5
dishonest, and it costs about an hour to remove.

**Fix**: move the canonical form to the **fragment** — `#server=…&tool=NAME`. Fragments are never sent
to the origin server and never appear in a `Referer`. Detail in §4.

---

## 4. Session A — selection moves to the fragment

No new visual pattern; nothing on screen changes. **Shippable on its own, and not blocked by the §5
gate.** Do this one first: it is what licenses the §5 copy.

### 4.1 `src/ui/selectionUrl.ts`

- `selectionSearch` → **`selectionParams`**, same output format (`server=…&tool=…`) with no leading
  `?`; `App` chooses the sigil. Done.
- Add **`readParams(location: { search: string; hash: string }): string`** — the back-compat rule, pure
  and testable here rather than inline in `App`. Done.

> **Two corrections, both found by running the code. The plan was wrong; the notes below are right.**
>
> 1. **`parseSelection` does *not* tolerate a leading `#`.** This plan originally said it did and told
>    the implementer not to "fix" it. `URLSearchParams` strips a leading `?` **only** — `#tool=t` parses
>    to a key literally named `#tool`, and the selection reads as home. It nearly slipped through
>    because a *multi*-parameter fragment survives by luck: only the first key gets the `#` glued on, so
>    `#server=a&tool=t` still finds `tool`. A demo-server selection (`#tool=t`, one parameter, no
>    server) is the case that breaks, and it is the case the demo produces.
>    **Resolution**: `readParams` strips the sigil and returns **bare** parameters, so its output is
>    exactly `parseSelection`'s input and symmetric with `selectionParams`' output. A test pins that
>    round trip.
> 2. **"Contains a `server` key" is the wrong test for which half wins.** A demo-server selection has
>    no `server` at all (`selectionParams(undefined, sel)` → `tool=NAME`), so that rule would send it to
>    the query and lose the selection. The rule is **any of our keys carrying a non-empty value** —
>    which also keeps the result outline out: `#server` as a bare heading slug parses to an empty value
>    and correctly falls through to the query.

### 4.2 `src/App.tsx`

- `writeUrl` (line 33) currently does `pushState(null, "", search || pathname)`. **Trap**: passing a
  bare `"#…"` to `pushState` resolves against the current URL and *preserves an existing query string*,
  so a visitor arriving on a legacy `?server=` link would end up with both. Build the whole relative
  URL explicitly: `window.location.pathname + (params ? "#" + params : "")`. Same in `disconnect`
  (line 77), which already writes `pathname` and is therefore already correct.
- The initial read at line 22-24 (`new URLSearchParams(window.location.search).get("server")`) and the
  deep-link read in `handleConnected` (line 42-45) both go through `readParams(window.location)`.
- The `popstate` listener (line 65-71) needs no change: `popstate` fires for same-document fragment
  navigations, including those made by `pushState`. Verify this in the browser rather than trusting it
  — it is the one behaviour here that jsdom models loosely.
- `copyLink` (line 88-89) copies `window.location.href` verbatim and keeps working untouched. That is
  the point of having kept the address bar authoritative.

### 4.3 Known trade-off — accept, do not fix

`Outline.tsx:87` renders a `href` of `#` plus the heading's slug for each entry. Clicks are already intercepted
(`preventDefault` + manual `scrollIntoView`, line 90-95) precisely so that "history belongs to selection
here (S1)", so **normal use is unaffected**. What changes is that middle-clicking an outline entry, or
using the browser's "copy link address" on one, now yields a URL whose fragment is a heading slug and
which therefore no longer names a server. Leave it: `href="#id"` is the correct accessible markup for a
document outline, the sanctioned share path is the Copy link control, and the alternative (synthesising
a combined fragment) would put selection state into 76 anchors that exist to scroll. Record the
trade-off in the spec; do not paper over it.

### 4.4 Tests (Tier 1) — done

- `selectionUrl.test.ts`: `readParams` prefers the hash when it carries `server`; falls back to the
  query when the hash is empty, when the hash carries only a heading slug (`#some-heading` — the
  Outline case), and when the hash is malformed; returns `""` when neither has anything.
- `App.test.tsx`: a `#server=…&tool=NAME` deep link opens the tool — mirroring the existing `?server=`
  test rather than replacing it, since **both must pass**. Keep the ISSUE-8 regression assertion
  (`data-active` on the deep-linked row, ↓ continues from it) in whichever of the two it currently sits.
- Check `src/ui/ConnectScreen.test.tsx` and `src/ui/recents.test.ts` for incidental `?server=`
  assumptions before assuming they are unaffected.

### 4.5 Browser verification — done 2026-08-30, 11/11 passed

Per ISSUE-7 and ISSUE-10, both of which passed every unit test and failed in a real browser:

1. Build, serve, open a `#server=` link to a server in recents → connects, deck opens on the subject.
2. Open a legacy `?server=` link to a server in recents → still connects; address bar rewrites to `#`.
3. Back/Forward walk selection (this is the `popstate` check).
4. **The measurement that is the whole point**: with DevTools' Network panel filtered to Doc, reload a
   `#server=…` page and confirm the document request's URL carries **no** query string.

Run headless against the production build on 2026-08-30, all passing: the document request for a
`#server=…&tool=…` link is `http://host/` with no query string and no trace of the server address; the
address box is still filled from the fragment; an unknown server still makes **zero** off-origin
requests before the click (ISSUE-12 intact); selecting writes `#tool=create_issue` and no query; Back
and Forward walk selection, confirming `popstate` does fire for fragment navigations; reloading a
selected page still sends a bare URL; and a stale `?server=` is cleared from the bar once connected.

Recorded for the next person driving this app headlessly: the workspace's region role is **implicit**
(`<section aria-label>`), so a CSS selector `[role=region]` matches nothing. Use Playwright's
`getByRole("region", …)`, which computes the role, as the RTL tests do.

---

## 5. Session B — the trust statement on the landing page

> **APPROVAL GATE.** The expanded panel is new furniture on the hero, which CLAUDE.md's Visual
> Consistency rule puts behind explicit user confirmation. **Do not build §5 without it**, even under an
> instruction to implement this whole plan. §4 is unaffected and should ship regardless.

### 5.1 Placement — recommendation

A permanent line beneath the two doors in `ConnectScreen.tsx` (after the `</div>` closing `.doors`,
line 289), carrying one sentence and a `▸ How this works` disclosure that reuses the existing
`.disclose` control already used by "Add headers" (`ConnectScreen.tsx:213`, `.module.css:164`).

Rationale, against the recorded taste for permanent furniture over surfaces that arrive: the statement
must be readable *before* anyone types a token, so it cannot be a modal, a toast, or anything that
appears on interaction. It sits below the doors rather than above them because it answers a question
the doors provoke.

**Nothing is added post-connect.** The chrome band already carries server identity and transport; a
trust badge there would be furniture with no job, and repeating a promise once it has been acted on
reads as anxiety.

### 5.2 The claims, and what licenses each

Every line below is licensed by a row of §2. **If a claim's evidence is not in that table, the claim
does not ship.**

At rest (one sentence, always visible):

> Runs entirely in your browser. Your tokens and everything your server returns stay on this device.

Expanded (`How this works`):

- **This page is a set of static files.** There is no server of ours behind it, so there is nothing for
  it to send anything to. *(§2 row 1)*
- **Your browser talks to your MCP server directly.** The requests come from this tab, on your network,
  with your headers. *(§2 rows 2, 6)*
- **No analytics, no trackers, no third-party scripts.** *(§2 rows 3, 5)*
- **Tokens are stored only on this device**, in this browser's local storage, and are sent only to the
  server you saved them against. They are never put in a link. *(§2 row 6)*
- **Nothing your server returns is stored or transmitted anywhere.** Results live in the tab until you
  close it. *(§2 row 7)*
- **The demo server runs inside this tab** and makes no network requests at all. *(§2 row 8)*
- **The browser enforces this, not just us**: a Content-Security-Policy in the page stops it loading
  code from anywhere but this origin. *(§2 row 9)*

Note the wording: *loading code from anywhere but this origin*. Do **not** write "no code from your
server can run here" — §5.3's last item is why.

### 5.3 What must not be claimed — the honest edges

These belong in the expanded panel too. A trust statement that omits its own limits is marketing.

- **"We can't see anything" is false.** GitHub Pages serves the files, so GitHub sees the request for
  the page — your IP address and browser — exactly as any website's host does. It never sees what you
  do with the page. Say this; do not let a reader discover it.
- **Something *is* stored on the device**: recent server URLs, any headers explicitly saved with
  "Remember headers on this device", the light/dark choice, and the dune-mode flag. Name local storage
  and say clearing site data removes it. Do not write "nothing is stored".
- **A failed connection sends one extra request** to the address you typed — the `no-cors` reachability
  probe (`src/mcp/probe.ts`) that distinguishes "CORS blocked it" from "the host never answered". It
  goes to your server, not to us, and only after a failure.
- **The example chips contact third parties.** Clicking DeepWiki, TripGo, Exa, Hugging Face or
  Microsoft Learn connects your browser to that operator, under their terms, not ours.
- **Tokens are not encrypted at rest.** Local storage is plain text and is readable by anything else
  running on this origin. This is why "Remember headers" is opt-out by default (`remember` initialises
  `false`, `ConnectScreen.tsx:37`) and it should stay that way.
- **Do not claim any audit, certification, or that the code has been reviewed by anyone.** The security
  review behind ISSUE-11 → ISSUE-15 was self-conducted; saying "audited" would be the one dishonest
  sentence on a page about honesty.
- **One piece of what your server sends is compiled, not just displayed** (ISSUE-18, added after this
  plan was first written). If a tool declares an `outputSchema`, the MCP SDK's validator turns that
  schema into a JavaScript function to check results against — the only place in the app where
  something a server sent reaches a code generator. It is a schema, not a script, and AJV 8 is hardened
  against it, but it is real and it is why the policy carries `'unsafe-eval'`. **[TODO-33](../../TODO.md)
  removes it** by swapping in a validator that interprets rather than generates.

  **Sequencing call**: if TODO-33 lands before Session B, this item is deleted and the §5.2 bullet
  becomes the stronger "nothing your server sends is ever run as code". If it has not, the item ships as
  written. Do not ship Session B claiming the stronger version against the weaker CSP — check
  `index.html` at the time of writing, not this plan.

### 5.4 Tone

Sentences a non-technical visitor can act on, per the recorded preference for describing behaviour in
terms someone can point at. "Your browser talks to your server directly" — not "browser-direct
architecture with no proxy layer". No shield iconography, no padlocks, no green ticks: the visual system
has no security-signalling vocabulary and inventing one to say "trust us" is the wrong instinct anyway.

### 5.5 Tests (Tier 2)

`ConnectScreen.test.tsx`: the at-rest sentence renders on first paint; the disclosure opens and closes;
the honest-edges items are present in the expanded panel. Deliberately **not** asserting the copy
word-for-word beyond one anchoring phrase per claim — a test that pins prose gets deleted the first time
someone edits a comma.

**Declined**: a guard test that greps the source for new `fetch` calls to keep the claims true. It
would be brittle (the SDK's own transports are indistinguishable from a rogue call at that level) and
redundant with the CSP, which is the actual enforcement and is declarative. If the claims and the code
ever drift, the CSP is the thing that will notice.

---

## 6. Documentation to update — in the same change, not after

- `docs/functional-description.md` — the landing page's trust statement and what it says; and, from §4,
  that shareable links now use `#`.
- `docs/architecture-overview.md` — the URL contract (`#server=`, with `?server=` read for
  compatibility), and a short "what leaves the device" section carrying §2's table. That table is the
  durable artefact here: the next person to add a dependency needs to know a claim depends on it.
- `docs/specs/` — a dated spec for the copy if §5's design gate produces anything beyond what §5.2
  already fixes. If it does not, this plan is the record and no spec is needed.
- `DEPLOYMENTS.md` on release, per CLAUDE.md.

---

## 7. Preconditions for the implementing session

1. **Branch.** At the time of writing, the working tree has staged, uncommitted changes on
   `fix/security-review-hardening` (the ISSUE-11 → ISSUE-15 fixes and their docs), possibly owned by a
   concurrent session. `src/ui/ConnectScreen.tsx`, `src/ui/ConnectScreen.module.css`,
   `src/App.test.tsx`, `docs/functional-description.md` and `docs/architecture-overview.md` are all
   **both** modified there and touched here. Confirm with the user whether that work has landed before
   starting; do not rebase or restage another session's files.
2. **The §5 approval gate** (§5's banner) must be answered before any of Session B is built.
3. Read [`docs/specs/2026-08-24-initial-design.md`](../specs/2026-08-24-initial-design.md) decisions #1
   and #9, and [`docs/specs/2026-08-29-addressable-selection.md`](../specs/2026-08-29-addressable-selection.md)
   before touching the URL contract.

## 8. Out of scope

- A privacy-policy page. The panel is the statement; a second document would only drift from it.
- Anything that would reduce what is stored locally (recents, remembered headers). The storage is a
  feature the visitor opted into and §5.3 discloses it.
- [TODO-7](../../TODO.md)'s CORS proxy, which would invalidate half of §2 and was declined on 2026-08-30
  for separate reasons.
