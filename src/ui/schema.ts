export interface SchemaRow {
  name: string
  type: string
  required: boolean
  description?: string
  enumValues?: string[]
  defaultValue?: string
}

function plainType(p: Record<string, unknown>): string {
  if (Array.isArray(p.enum)) return "enum"
  if (p.type === "array") {
    const items = typeof p.items === "object" && p.items !== null ? (p.items as Record<string, unknown>) : {}
    return `${typeof items.type === "string" ? items.type : "any"}[]`
  }
  return typeof p.type === "string" ? p.type : "any"
}

/**
 * Resolve the simple `anyOf`/`oneOf` unions real servers actually publish, so a
 * field like deepwiki's `repoName: string | string[]` gets a usable control
 * instead of a raw-JSON box. Only unions with one honest answer collapse:
 * identical branches, "one or many" of the same scalar (the list control
 * satisfies both), and number/integer. Anything else stays "any" — better a
 * JSON field than a control that quietly drops a branch.
 */
function unionType(branches: unknown[]): string {
  const names = branches.map((b) =>
    typeof b === "object" && b !== null ? plainType(b as Record<string, unknown>) : "any",
  )
  if (names.length === 0 || names.includes("any")) return "any"
  const set = new Set(names)
  if (set.size === 1) return names[0]
  if (set.size === 2 && set.has("string") && set.has("string[]")) return "string[]"
  if ([...set].every((n) => n === "number" || n === "integer")) return "number"
  return "any"
}

function typeName(p: Record<string, unknown>): string {
  const union = p.anyOf ?? p.oneOf
  if (Array.isArray(union)) return unionType(union)
  return plainType(p)
}

/** Newcomer-friendly rendering of a schemaRows type; raw protocol names stay available beside it. */
export function friendlyType(raw: string): string {
  if (raw.endsWith("[]")) return `list of ${friendlyType(raw.slice(0, -2))}`
  switch (raw) {
    case "string":
      return "text"
    case "integer":
      return "number"
    case "boolean":
      return "true / false"
    case "enum":
      return "one of"
    default:
      return raw
  }
}

/**
 * An `enum` member need not be a string — JSON Schema allows any value, and a
 * server is free to list objects. `String(value)` rendered those as the literal
 * text `[object Object]`, which is neither the value nor a usable label
 * (TODO-12). `JSON.stringify` returns `undefined` for `undefined` and for
 * functions, so `String` remains the floor.
 */
function enumLabel(value: unknown): string {
  if (typeof value === "string") return value
  return JSON.stringify(value) ?? String(value)
}

// Schemas come from an untrusted server: treat as unknown, narrow defensively.
export function schemaRows(schema: unknown): SchemaRow[] {
  if (typeof schema !== "object" || schema === null) return []
  const s = schema as { properties?: unknown; required?: unknown }
  if (typeof s.properties !== "object" || s.properties === null) return []
  const required = new Set(
    Array.isArray(s.required) ? s.required.filter((r): r is string => typeof r === "string") : [],
  )
  return Object.entries(s.properties as Record<string, unknown>).map(([name, raw]) => {
    const p = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {}
    return {
      name,
      type: typeName(p),
      required: required.has(name),
      description: typeof p.description === "string" ? p.description : undefined,
      enumValues: Array.isArray(p.enum) ? p.enum.map(enumLabel) : undefined,
      defaultValue: p.default !== undefined ? JSON.stringify(p.default) : undefined,
    }
  })
}
