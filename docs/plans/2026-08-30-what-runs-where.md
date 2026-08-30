# Implementation plan — describing what runs where, and removing the one thing that made the description untrue

**Date**: 2026-08-30
**Status**: **§4 (Session A) done 2026-08-30** on `feat/what-runs-where`. §5 not started — it carries an
unresolved design-approval gate.
**TODO**: [TODO-31](../../TODO.md)
**Complexity**: S

---

## 1. Why

The app has an unusual architecture — zero backend, browser-direct, tokens never in URLs
([initial design](../specs/2026-08-24-initial-design.md) decisions #1 and #9) — and the landing page
describes none of it. A visitor is asked to paste the address of an internal MCP server, and often a
bearer token beside it, into a page hosted at `martyntamerlane.github.io`, with nothing on screen
saying what happens to either.

**This plan does not add a safety claim, and §5.0 forbids one.** It adds a description of what runs,
what connects to what, and what is stored where, so that a reader can assess it themselves. That is a
user instruction from 2026-08-30 and it governs every sentence of Session B.

§2 is the verification behind the description — what is actually true, checked rather than assumed.
§3 is the one thing that was *not* true, which Session A (§4) has since fixed: a description whose
first line needs an asterisk is not a description, it is a claim with a disclaimer.

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
| **What the page restricts.** `script-src 'self'` (no `'unsafe-eval'`), `object-src`/`frame-src`/`form-action`/`base-uri` `'none'`. `connect-src *` is the one open door and it is the product. | `index.html` (ISSUE-14) |
| **Nothing a server sends becomes code.** The SDK is given an interpreting JSON Schema validator instead of its default, which compiled each `outputSchema` with `new Function`. | `src/mcp/validator.ts`; ISSUE-18; TODO-33, **done 2026-08-30** |

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

**Fix**: move the canonical form to the **fragment** — `#server=…&tool=NAME`. Fragments are not sent
to the origin server and do not appear in a `Referer`. Detail in §4. **Done 2026-08-30.**

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

## 5. Session B — a description of what runs, on the landing page

> **APPROVAL GATE.** The expanded panel is new furniture on the hero, which CLAUDE.md's Visual
> Consistency rule puts behind explicit user confirmation. **Do not build §5 without it**, even under an
> instruction to implement this whole plan. §4 is unaffected and shipped regardless.

### 5.0 The governing rule — read this before writing a single sentence

**No safety claims. Ever.** Not "safe", not "secure", not "private", not "protected", not "trusted", and
no reassurance framing — no "so you can trust it", no "nothing to worry about", no "don't worry, …".
The panel's job is to **describe what runs, what connects to what, and what is stored where**, and then
stop. The reader decides what that means for them; we do not decide it for them.

This is a user instruction (2026-08-30), and it supersedes the earlier framing of this section, which
was a claims table and was wrong.

The working test for any sentence: **is it an observable fact about mechanism, or is it a conclusion
about how the reader should feel?** "Requests go from this tab to the address you type" is the first.
"Your data never leaves your device" is the second wearing the first's clothes — it is a promise, it
needs a footnote about the page request itself, and the footnote is the tell.

The corollary that makes this rule *easier*, not harder: the awkward facts go in **in the same voice as
the flattering ones**, with no hedging and no apology. Unencrypted local storage, the schema
compilation, the host seeing the page request — these stop being admissions the moment nothing around
them is a boast. A description has no edges to manage, which is exactly why this is the better design.

**Vocabulary to avoid**, beyond the obvious: "enforced", "guaranteed", "we never", "we can't",
"only ever", "completely", "entirely", "at all times". Each smuggles a promise into a sentence that
could have stated a mechanism instead.

### 5.1 Placement — recommendation

A permanent block beneath the two doors in `ConnectScreen.tsx` (after the `</div>` closing `.doors`),
carrying one descriptive line and a `▸ What runs where` disclosure that reuses the existing `.disclose`
control already used by "Add headers" (`ConnectScreen.tsx:213`, `.module.css:164`).

Rationale, against the recorded taste for permanent furniture over surfaces that arrive: it must be
readable *before* anyone types a token, so it cannot be a modal, a toast, or anything that appears on
interaction. It sits below the doors rather than above them because it answers a question the doors
provoke rather than announcing itself first.

**Nothing is added post-connect.** The chrome band already carries server identity and transport.

### 5.2 The content — an inventory, not an argument

Grouped by question, because that is how someone assessing it will read. Every line is licensed by a
row of §2; **if a line's evidence is not in that table, it does not ship.** Wording below is the
intended register, not final copy.

At rest (always visible, one line):

> This page is static files running in your browser. It connects to the MCP server address you enter.

Expanded — **Where the code runs**

- The page is a set of static files served by GitHub Pages. There is no application server behind it.
  *(§2 row 1)*
- Everything after the page loads happens in this browser tab: connecting, parsing, rendering. *(§2 rows 2, 8)*

Expanded — **What this page connects to**

- Requests to an MCP server go from this tab to the address in the box, with any headers you add. *(§2 rows 2, 6)*
- After a connection fails, one further request goes to that same address, to tell a blocked
  cross-origin response apart from a host that never answered. *(§2 row 2; `src/mcp/probe.ts`)*
- The example buttons connect to servers run by DeepWiki, TripGo, Exa, Hugging Face and Microsoft
  Learn, under their terms. *(§2 row 4)*
- GitHub Pages serves the files, so it receives the request for the page — your IP address and browser
  — as any web host does.
- No analytics, telemetry or third-party scripts are loaded. Fonts are served from this origin. *(§2 rows 3, 5)*

Expanded — **What is stored, and where**

- In this browser's local storage: recent server addresses, headers you chose to remember, and your
  light/dark setting. Stored as plain text, readable by anything else running on this origin. Clearing
  site data removes it. *(§2 row 6)*
- In memory, for this tab only: everything a server returns. Closing the tab discards it. *(§2 row 7)*
- In the address bar: the server address and the selected item, in the `#` fragment — which browsers do
  not send to the host. Headers and tokens are never put in a URL. *(§4, §2 row 6)*

Expanded — **What this page does with what a server sends**

- Names, descriptions, and results are rendered as text. Nothing a server sends is inserted as HTML.
  *(verified: no `dangerouslySetInnerHTML` or `innerHTML` anywhere in `src/`; `Markdown.tsx:8` records
  the rule)*
- If a tool declares an `outputSchema`, results are checked against it by a validator that reads the
  schema. Nothing a server sends is turned into code. *(§2 row 10)*
- A Content-Security-Policy in the page limits what can load: scripts from this origin only, no
  plugins, no framing, no form submission. *(§2 row 9)*
- The source is public at `github.com/martyntamerlane/mcp-explore`. It has not been independently
  audited.

Note what the last group still does, even with the compilation gone: it states the parts a claims
framing would have had to manage as exceptions — that the source is public and has not been audited,
that a CSP limits what can load without that being offered as a guarantee.

**[TODO-33](../../TODO.md) landed first (2026-08-30)**, which is why those two bullets read as they do.
The reasoning is worth keeping: writing the description is what made it obvious that "a schema your
server sends is compiled into a function in your browser" was a sentence better deleted from the world
than written well. Describing a system honestly is a good way to find the parts you would rather not
have to describe. Still check `index.html` at the time of writing rather than trusting this plan.

### 5.3 Tone

Short declarative sentences about mechanism, in terms a reader can point at — per the recorded
preference for describing behaviour by what is on screen rather than by class names. "Requests go from
this tab to the address in the box", not "browser-direct architecture with no proxy layer".

No shield iconography, no padlocks, no green ticks, no colour used to signal reassurance. The visual
system has no security-signalling vocabulary; inventing one would be making a claim in pictures after
carefully not making one in words. The block should look like every other quiet, factual part of the
page — because that is what it is.

### 5.4 Tests (Tier 2)

`ConnectScreen.test.tsx`: the at-rest line renders on first paint; the disclosure opens and closes; and
the four groups are present when open. Assert one anchoring phrase per group rather than the prose
word-for-word — a test that pins copy gets deleted the first time someone edits a comma.

Worth one test that would otherwise never be written: **assert the panel contains the awkward facts** —
local storage, the post-failure probe, the third-party example servers, the schema compilation. Those
are the lines a future well-meaning edit would tidy away for being off-message, and that edit is exactly
what turns this back into a claim.

**Declined**: a guard test that greps the source for new `fetch` calls. It would be brittle (the SDK's
own transports are indistinguishable from a rogue call at that level) and redundant with the CSP, which
is declarative and is what would actually notice.

## 6. Documentation to update — in the same change, not after

- `docs/functional-description.md` — what the landing page's description block says; and, from §4,
  that shareable links now use `#`. *(§4's half done.)*
- `docs/architecture-overview.md` — the URL contract (`#server=`, with `?server=` read for
  compatibility), and a "what leaves the device" section carrying §2's table. That table is the durable
  artefact here: the next person to add a dependency needs to know that a line of on-screen text
  describes it. *(Both done 2026-08-30.)*
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
2. **The §5 approval gate** (§5's banner) must be answered before any of Session B is built, and
   **§5.0's no-claims rule read first** — it is the constraint the section exists under, not a style note.
3. Read [`docs/specs/2026-08-24-initial-design.md`](../specs/2026-08-24-initial-design.md) decisions #1
   and #9, and [`docs/specs/2026-08-29-addressable-selection.md`](../specs/2026-08-29-addressable-selection.md)
   before touching the URL contract.

## 8. Out of scope

- A privacy-policy page. A policy is a set of promises; §5.0 rules those out, and a second document
  would drift from the panel besides.
- Anything that would reduce what is stored locally (recents, remembered headers). The storage is a
  feature the visitor opted into, and §5.2 describes it rather than defending it.
- [TODO-7](../../TODO.md)'s CORS proxy, which would invalidate half of §2 and was declined on 2026-08-30
  for separate reasons.
