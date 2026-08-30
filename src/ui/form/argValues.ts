import { schemaRows, type SchemaRow } from "../schema"

/**
 * Turns an untrusted JSON Schema into the field specs the argument form renders,
 * and turns the form's string values back into a `tools/call` arguments object
 * (tool-first workspace spec §5).
 *
 * Every value the form holds is a string — one storage shape for every control,
 * so a part-filled form is trivially serialisable and comparable. Coercion to
 * real JSON types happens once, here, at assembly time.
 */
export type FieldKind = "text" | "number" | "boolean" | "enum" | "stringList" | "json"

export interface FieldSpec {
  name: string
  kind: FieldKind
  required: boolean
  description?: string
  enumValues?: string[]
  /** The schema's own type name, shown beside the friendly one and on JSON fallbacks. */
  rawType: string
  /** Prefill from the schema's `default`, or "" — never undefined. */
  initial: string
}

export type Values = Record<string, string>

export interface Assembly {
  args: Record<string, unknown>
  /** Per-field problems (unparseable number/JSON). A field with an error is omitted from args. */
  errors: Record<string, string>
  /** Required fields left empty. */
  missing: string[]
}

function kindOf(row: SchemaRow): FieldKind {
  if (row.enumValues) return "enum"
  if (row.type === "string[]") return "stringList"
  if (row.type === "string") return "text"
  if (row.type === "number" || row.type === "integer") return "number"
  if (row.type === "boolean") return "boolean"
  return "json"
}

// schemaRows hands defaults back JSON-encoded. Scalar controls want the plain
// value ("open", not "\"open\""); the JSON fallback wants the encoding intact.
function initialOf(row: SchemaRow, kind: FieldKind): string {
  if (row.defaultValue === undefined) return ""
  if (kind === "json") return row.defaultValue
  try {
    const parsed: unknown = JSON.parse(row.defaultValue)
    return parsed === null || typeof parsed === "object" ? row.defaultValue : String(parsed)
  } catch {
    return row.defaultValue
  }
}

export function fieldSpecs(schema: unknown): FieldSpec[] {
  return schemaRows(schema).map((row) => {
    const kind = kindOf(row)
    return {
      name: row.name,
      kind,
      required: row.required,
      ...(row.description !== undefined ? { description: row.description } : {}),
      ...(row.enumValues !== undefined ? { enumValues: row.enumValues } : {}),
      rawType: row.type,
      initial: initialOf(row, kind),
    }
  })
}

export function initialValues(specs: FieldSpec[]): Values {
  return Object.fromEntries(specs.map((s) => [s.name, s.initial]))
}

function coerce(spec: FieldSpec, raw: string): { value?: unknown; error?: string } {
  switch (spec.kind) {
    case "number": {
      const n = Number(raw)
      return Number.isFinite(n) ? { value: n } : { error: "must be a number" }
    }
    case "boolean":
      return { value: raw === "true" }
    case "stringList": {
      const items = raw
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s !== "")
      return { value: items }
    }
    case "json":
      try {
        return { value: JSON.parse(raw) }
      } catch {
        return { error: "invalid JSON" }
      }
    default:
      return { value: raw }
  }
}

/**
 * Empty optional fields are omitted rather than sent as "" — a server that
 * distinguishes "absent" from "empty" must see absent, and every demo/remote
 * tool with optional args relies on it.
 */
export function assembleArgs(specs: FieldSpec[], values: Values): Assembly {
  const args: Record<string, unknown> = {}
  const errors: Record<string, string> = {}
  const missing: string[] = []

  for (const spec of specs) {
    const raw = values[spec.name] ?? ""
    if (raw.trim() === "") {
      if (spec.required) missing.push(spec.name)
      continue
    }
    const { value, error } = coerce(spec, raw)
    if (error !== undefined) errors[spec.name] = error
    else args[spec.name] = value
  }

  return { args, errors, missing }
}

/** True when the form is safe to submit: nothing required is blank, nothing malformed. */
export function canSubmit(assembly: Assembly): boolean {
  return assembly.missing.length === 0 && Object.keys(assembly.errors).length === 0
}

/**
 * The inverse of `assembleArgs`: a past run's arguments back into form strings,
 * so restoring a run from the history refills the fields that produced it and
 * "edit and re-run" is one click (interaction roadmap S3).
 *
 * Arguments come back out of a record the app itself wrote, but the record holds
 * `unknown` — a JSON field can contain anything — so every branch is total.
 */
export function valuesFromArgs(specs: FieldSpec[], args: Record<string, unknown>): Values {
  const asText = (v: unknown): string => (typeof v === "string" ? v : JSON.stringify(v) ?? String(v))
  return Object.fromEntries(
    specs.map((spec) => {
      const value = args[spec.name]
      if (value === undefined) return [spec.name, ""]
      switch (spec.kind) {
        case "stringList":
          return [spec.name, Array.isArray(value) ? value.map(asText).join(", ") : asText(value)]
        case "json":
          return [spec.name, JSON.stringify(value, null, 2) ?? ""]
        case "boolean":
          return [spec.name, value === true ? "true" : "false"]
        default:
          return [spec.name, asText(value)]
      }
    }),
  )
}
