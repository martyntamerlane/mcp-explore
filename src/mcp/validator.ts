import { CfWorkerJsonSchemaValidator } from "@modelcontextprotocol/sdk/validation/cfworker"

/**
 * The JSON Schema validator every client is built with (TODO-33 / ISSUE-18).
 *
 * When a tool declares an `outputSchema`, the SDK validates each result against
 * it. Its default validator is AJV, which compiles the schema into a JavaScript
 * function with `new Function` — so a schema from a server we do not trust
 * became executable code in the visitor's browser. Not a known exploit (AJV 8
 * is hardened, and AJV's own guidance is simply that untrusted schemas should
 * not be compiled), but it was the one place in this app where untrusted input
 * reached a code generator, and there was no reason to keep it.
 *
 * `CfWorkerJsonSchemaValidator` interprets the schema instead of generating code
 * — the SDK ships it for edge runtimes that forbid `eval`, and a browser page
 * that renders untrusted servers wants the same property for the same reason.
 *
 * **The name is a coincidence — this has nothing to do with TODO-7's declined
 * CORS proxy.** `@cfworker/json-schema` is a dependency-free library written by
 * the Cloudflare Workers team *for* runtimes that ban code generation; it runs
 * in the visitor's browser and makes no network calls of any kind (checked: no
 * `fetch`, no Cloudflare API, no URLs in the shipped code). Nothing here adds a
 * backend, and the zero-backend decision is untouched.
 * With it, `script-src` needs no `'unsafe-eval'`.
 *
 * Note what this does *not* do: AJV is still in the bundle, because the SDK's
 * client module imports it statically. It is never instantiated and never runs,
 * which is what matters here — the cost is bytes, not behaviour.
 *
 * `shortcircuit` is left at its default (true): the first error is what the SDK
 * puts in its message, and validating the rest of a bad result buys nothing.
 */
export const jsonSchemaValidator = new CfWorkerJsonSchemaValidator()
