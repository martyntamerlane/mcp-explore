export interface SchemaRow {
  name: string
  type: string
  required: boolean
  description?: string
  enumValues?: string[]
  defaultValue?: string
}

function typeName(p: Record<string, unknown>): string {
  if (Array.isArray(p.enum)) return "enum"
  if (p.type === "array") {
    const items = typeof p.items === "object" && p.items !== null ? (p.items as Record<string, unknown>) : {}
    return `${typeof items.type === "string" ? items.type : "any"}[]`
  }
  return typeof p.type === "string" ? p.type : "any"
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
      enumValues: Array.isArray(p.enum) ? p.enum.map(String) : undefined,
      defaultValue: p.default !== undefined ? JSON.stringify(p.default) : undefined,
    }
  })
}
