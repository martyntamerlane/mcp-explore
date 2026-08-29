import { expect, test } from "vitest"
import { assembleArgs, fieldSpecs, initialValues } from "./argValues"

const schema = {
  type: "object",
  properties: {
    title: { type: "string", description: "Issue title" },
    limit: { type: "integer", default: 20 },
    urgent: { type: "boolean" },
    status: { type: "string", enum: ["open", "closed"] },
    labels: { type: "array", items: { type: "string" } },
    nested: { type: "object", properties: { a: { type: "string" } } },
  },
  required: ["title"],
}

test("maps schema properties to field kinds", () => {
  expect(fieldSpecs(schema).map((f) => [f.name, f.kind])).toEqual([
    ["title", "text"],
    ["limit", "number"],
    ["urgent", "boolean"],
    ["status", "enum"],
    ["labels", "stringList"],
    ["nested", "json"],
  ])
})

test("required flags come from the schema", () => {
  expect(fieldSpecs(schema).find((f) => f.name === "title")?.required).toBe(true)
  expect(fieldSpecs(schema).find((f) => f.name === "limit")?.required).toBe(false)
})

test("defaults prefill", () => {
  expect(initialValues(fieldSpecs(schema)).limit).toBe("20")
  expect(initialValues(fieldSpecs(schema)).title).toBe("")
})

test("untrusted shapes never throw", () => {
  for (const bad of [null, 42, "x", {}, { properties: 7 }, { properties: { a: null } }, { required: "nope" }]) {
    expect(() => fieldSpecs(bad)).not.toThrow()
  }
})

test("empty optionals are omitted, not sent as empty strings", () => {
  const specs = fieldSpecs(schema)
  const { args } = assembleArgs(specs, { ...initialValues(specs), title: "hi", limit: "" })
  expect(args).toEqual({ title: "hi" })
})

test("numbers are coerced, bad numbers reported", () => {
  const specs = fieldSpecs(schema)
  expect(assembleArgs(specs, { title: "t", limit: "5" }).args.limit).toBe(5)
  expect(assembleArgs(specs, { title: "t", limit: "abc" }).errors.limit).toMatch(/number/i)
})

test("booleans, enums and string lists convert", () => {
  const specs = fieldSpecs(schema)
  const { args } = assembleArgs(specs, { title: "t", urgent: "true", status: "open", labels: "a, b ,c" })
  expect(args).toMatchObject({ urgent: true, status: "open", labels: ["a", "b", "c"] })
})

test("json fields parse, and report their own syntax errors", () => {
  const specs = fieldSpecs(schema)
  expect(assembleArgs(specs, { title: "t", nested: '{"a":"b"}' }).args.nested).toEqual({ a: "b" })
  expect(assembleArgs(specs, { title: "t", nested: "{oops" }).errors.nested).toMatch(/JSON/i)
})

test("missing required fields are listed", () => {
  const specs = fieldSpecs(schema)
  expect(assembleArgs(specs, { title: "" }).missing).toEqual(["title"])
  expect(assembleArgs(specs, { title: "there" }).missing).toEqual([])
})

test("a schema with no properties yields no fields", () => {
  expect(fieldSpecs({ type: "object", properties: {} })).toEqual([])
  expect(assembleArgs([], {})).toEqual({ args: {}, errors: {}, missing: [] })
})

test("prompt arguments become required-aware text fields", () => {
  const specs = fieldSpecs({
    type: "object",
    properties: { issue_id: { type: "string", description: "Which issue" } },
    required: ["issue_id"],
  })
  expect(specs).toEqual([
    {
      name: "issue_id",
      kind: "text",
      required: true,
      description: "Which issue",
      rawType: "string",
      initial: "",
    },
  ])
})
