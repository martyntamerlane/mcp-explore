import { schemaRows } from "./schema"

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
