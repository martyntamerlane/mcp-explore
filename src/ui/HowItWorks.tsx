import { useEffect, useRef, useState } from "react"
import { EXAMPLE_SERVERS } from "./examples"
import styles from "./HowItWorks.module.css"

/**
 * "How this page works" — the ⓘ beside the mode toggle, and the panel it opens.
 *
 * **This describes; it does not reassure.** No "safe", "secure", "private",
 * "protected", "guaranteed", "trusted"; no "we never", no "enforced". Every line
 * is an observable fact about mechanism, and the reader decides what it means for
 * them (user instruction, 2026-08-30; plan §5.0). `HowItWorks.test.tsx` holds that
 * stance to the wall two ways: it fails on any of those words, and it fails if the
 * awkward facts go missing — those being the lines a well-meaning edit tidies away
 * for being off-message, which is exactly the edit that turns this back into a claim.
 *
 * The panel is hand-rolled rather than a native `<dialog>`: jsdom implements no
 * `showModal`, so the whole thing would have been verified against a shim instead
 * of against itself (the ISSUE-10 lesson). Escape had to be intercepted here in
 * any case — see below.
 */
export default function HowItWorks() {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  /**
   * Escape is caught in the **capture** phase on `window` and stopped there.
   *
   * Not fussiness: to the deck, Escape means "clear the filter, then go home"
   * (`keynav.ts`), and home closes the connection. A bubble-phase handler would
   * let one keypress close this panel and drop the visitor's server with it —
   * the same overlay-precedence problem the console drawer had in 2026-08-27.
   * Only Escape is intercepted; Tab and the rest still reach the panel.
   */
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.stopPropagation()
      event.preventDefault()
      setOpen(false)
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [open])

  // Focus moves in on open and back to the ⓘ on close. Reintroducing an overlay
  // reintroduces the obligation the drawer's deletion retired (TODO-12).
  useEffect(() => {
    if (open) panel.current?.focus()
    else trigger.current?.focus({ preventScroll: true })
  }, [open])

  // `aria-modal` tells assistive tech the rest of the page is inert; without a
  // trap that would be true for a screen reader and false for the Tab key.
  function onTab(event: React.KeyboardEvent) {
    if (event.key !== "Tab" || panel.current === null) return
    const focusable = panel.current.querySelectorAll<HTMLElement>("button, [href], input, [tabindex]:not([tabindex='-1'])")
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    } else if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
      event.preventDefault()
      last.focus()
    }
  }

  const operators = EXAMPLE_SERVERS.map((s) => s.name)
  const asList = operators.slice(0, -1).join(", ") + " and " + operators[operators.length - 1]

  return (
    <>
      <button
        type="button"
        ref={trigger}
        className={styles.icon}
        aria-label="How this page works"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true">i</span>
      </button>

      {open && (
        <div
          className={styles.backdrop}
          data-testid="howitworks-backdrop"
          onClick={() => setOpen(false)}
        >
          <div
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="howitworks-title"
            tabIndex={-1}
            ref={panel}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={onTab}
          >
            <div className={styles.head}>
              <h2 className={styles.title} id="howitworks-title">
                How this page works
              </h2>
              <button type="button" className={styles.close} aria-label="Close" onClick={() => setOpen(false)}>
                <span aria-hidden="true">✕</span>
              </button>
            </div>

            <div className={styles.body}>
              <section>
                <h3 className={styles.group}>Where the code runs</h3>
                <ul className={styles.list}>
                  <li>This page is a set of static files served by GitHub Pages. There is no application server behind it.</li>
                  <li>Everything after the page loads happens in this browser tab: connecting, reading the server's reply, drawing it.</li>
                </ul>
              </section>

              <section>
                <h3 className={styles.group}>What this page connects to</h3>
                <ul className={styles.list}>
                  <li>Requests to an MCP server go from this tab to the address you enter, with any headers you add.</li>
                  <li>
                    After a connection fails, one further request goes to that same address, to tell a blocked
                    cross-origin reply apart from a host that never answered.
                  </li>
                  <li>The example buttons connect to servers run by {asList}, under their terms.</li>
                  <li>
                    GitHub Pages serves the files, so it receives the request for the page — your IP address and
                    browser — as any web host does.
                  </li>
                  <li>No analytics, telemetry or third-party scripts are loaded. Fonts are served from this origin.</li>
                </ul>
              </section>

              <section>
                <h3 className={styles.group}>What is stored, and where</h3>
                <ul className={styles.list}>
                  <li>
                    In this browser's local storage: recent server addresses, headers you chose to remember, and your
                    light/dark setting. Held as plain text, readable by anything else running on this origin. Clearing
                    site data removes it.
                  </li>
                  <li>In memory, for this tab only: everything a server returns. Closing the tab discards it.</li>
                  <li>
                    In the address bar: the server address and the item you have open, after the <code>#</code> — which
                    browsers do not send to the host. Headers and tokens are not put in a URL.
                  </li>
                </ul>
              </section>

              <section>
                <h3 className={styles.group}>What this page does with what a server sends</h3>
                <ul className={styles.list}>
                  <li>Names, descriptions and results are drawn as text. Nothing a server sends is inserted as HTML.</li>
                  <li>
                    If a tool declares an output schema, results are checked against it by a validator that reads the
                    schema. Nothing a server sends is turned into code.
                  </li>
                  <li>
                    A Content-Security-Policy in the page limits what can load: scripts from this origin only, no
                    plugins, no framing, no form submission.
                  </li>
                  <li>
                    The source is public at <code>github.com/martyntamerlane/mcp-explore</code>. It has not been
                    independently audited.
                  </li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
