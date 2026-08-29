import { friendlyType, schemaRows } from "./schema"

test("flattens properties with types, required flags, enums and defaults", () => {
  const rows = schemaRows({
    type: "object",
    properties: {
      title: { type: "string", description: "Issue title" },
      labels: { type: "array", items: { type: "string" } },
      priority: { type: "string", enum: ["low", "medium", "high"], default: "medium" },
    },
    required: ["title"],
  })
  expect(rows).toEqual([
    { name: "title", type: "string", required: true, description: "Issue title", enumValues: undefined, defaultValue: undefined },
    { name: "labels", type: "string[]", required: false, description: undefined, enumValues: undefined, defaultValue: undefined },
    { name: "priority", type: "enum", required: false, description: undefined, enumValues: ["low", "medium", "high"], defaultValue: '"medium"' },
  ])
})

test("returns [] for schemas that are not object-with-properties", () => {
  expect(schemaRows(undefined)).toEqual([])
  expect(schemaRows(null)).toEqual([])
  expect(schemaRows("nope")).toEqual([])
  expect(schemaRows({ type: "object" })).toEqual([])
})

test("tolerates malformed property entries", () => {
  const rows = schemaRows({ properties: { weird: 7 }, required: "not-an-array" })
  expect(rows).toEqual([{ name: "weird", type: "any", required: false, description: undefined, enumValues: undefined, defaultValue: undefined }])
})

describe("friendlyType", () => {
  test.each([
    ["string", "text"],
    ["number", "number"],
    ["integer", "number"],
    ["boolean", "true / false"],
    ["enum", "one of"],
    ["any", "any"],
    ["object", "object"],
    ["string[]", "list of text"],
    ["integer[]", "list of number"],
    ["custom-thing", "custom-thing"],
  ])("%s → %s", (raw, friendly) => {
    expect(friendlyType(raw)).toBe(friendly)
  })
})

test("simple anyOf/oneOf unions resolve to one control-able type", () => {
  const rows = schemaRows({
    type: "object",
    properties: {
      // the common MCP "one or many" shape (deepwiki's ask_question.repoName)
      repoName: { anyOf: [{ type: "string" }, { type: "array", items: { type: "string" } }] },
      either: { oneOf: [{ type: "string" }, { type: "string" }] },
      numeric: { anyOf: [{ type: "number" }, { type: "integer" }] },
      mixed: { anyOf: [{ type: "string" }, { type: "object" }] },
    },
  })
  expect(rows.map((r) => [r.name, r.type])).toEqual([
    ["repoName", "string[]"],
    ["either", "string"],
    ["numeric", "number"],
    ["mixed", "any"],
  ])
})

test("a malformed union never throws and stays 'any'", () => {
  for (const bad of [{ anyOf: "nope" }, { anyOf: [] }, { anyOf: [null, 3] }]) {
    expect(schemaRows({ type: "object", properties: { x: bad } })[0].type).toBe("any")
  }
})
