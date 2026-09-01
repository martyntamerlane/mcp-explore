import { CLIENT_OPTIONS } from "./connect"
import { jsonSchemaValidator } from "./validator"

const schema = {
  type: "object" as const,
  properties: { n: { type: "number" as const } },
  required: ["n"],
}

/**
 * Replace the global `Function` binding for the duration of `run`.
 *
 * This is what turns "does not generate code" from a comment into an assertion.
 * AJV — the SDK's default validator — compiles each schema with `new Function`,
 * which resolves through this binding, so the SDK's default fails this and an
 * interpreting validator passes it (ISSUE-18 / TODO-33).
 */
function withNoCodeGeneration<T>(run: () => T): T {
  const real = globalThis.Function
  const trap = () => {
    throw new Error("code generation attempted")
  }
  globalThis.Function = new Proxy(real, { apply: trap, construct: trap }) as FunctionConstructor
  try {
    return run()
  } finally {
    globalThis.Function = real
  }
}

test("a server's schema is validated without ever reaching a code generator", () => {
  withNoCodeGeneration(() => {
    const validate = jsonSchemaValidator.getValidator(schema)
    expect(validate({ n: 1 }).valid).toBe(true)
  })
})

test("a result that does not match its schema is rejected, with a reason", () => {
  const validate = jsonSchemaValidator.getValidator(schema)
  const bad = validate({ n: "not a number" })
  expect(bad.valid).toBe(false)
  expect(bad.errorMessage).toBeTruthy()
  expect(validate({}).valid).toBe(false)
})

/**
 * The wiring, not just the validator. `connect.ts` has two `new Client(…)` call
 * sites and will grow more; this pins that what they hand the SDK is the
 * non-generating validator, so a third one that forgets the options is caught
 * here rather than by a CSP violation in someone's browser.
 */
test("the validator the client is built with is the non-generating one", () => {
  expect(CLIENT_OPTIONS.jsonSchemaValidator).toBe(jsonSchemaValidator)
  withNoCodeGeneration(() => {
    expect(CLIENT_OPTIONS.jsonSchemaValidator.getValidator(schema)({ n: 1 }).valid).toBe(true)
  })
})
