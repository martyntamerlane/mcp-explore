import { friendlyType } from "../schema"
import type { FieldSpec, Values } from "./argValues"
import styles from "./ArgsForm.module.css"

/**
 * Schema-driven argument fields (tool-first workspace spec §5). Every value is
 * held as a string and coerced once at assembly; unsupported schema shapes get
 * an honest JSON field labelled with their raw type rather than being hidden.
 */
export interface ArgsFormProps {
  specs: FieldSpec[]
  values: Values
  onChange: (name: string, value: string) => void
  errors: Record<string, string>
  /** Prefix so two forms on one page never share input ids. */
  idPrefix: string
}

export default function ArgsForm({ specs, values, onChange, errors, idPrefix }: ArgsFormProps) {
  return (
    <div className={styles.fields}>
      {specs.map((spec) => {
        const id = `${idPrefix}-${spec.name}`
        const value = values[spec.name] ?? ""
        const error = errors[spec.name]
        return (
          <div key={spec.name} className={styles.field}>
            <label className={styles.label} htmlFor={id}>
              <span className={styles.name}>{spec.name}</span>
              {spec.required && (
                <span className={styles.required} title="required">
                  ✱
                </span>
              )}
              <span className={styles.type}>{friendlyType(spec.rawType)}</span>
            </label>
            {spec.description && <p className={styles.description}>{spec.description}</p>}

            {spec.kind === "enum" && (
              <div className={styles.segmented} role="group" aria-labelledby={id}>
                <button
                  type="button"
                  id={id}
                  className={styles.option}
                  aria-pressed={value === ""}
                  onClick={() => onChange(spec.name, "")}
                >
                  unset
                </button>
                {(spec.enumValues ?? []).map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={styles.option}
                    aria-pressed={value === option}
                    onClick={() => onChange(spec.name, option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}

            {spec.kind === "boolean" && (
              <div className={styles.segmented} role="group" aria-labelledby={id}>
                {["", "true", "false"].map((option) => (
                  <button
                    key={option || "unset"}
                    type="button"
                    {...(option === "" ? { id } : {})}
                    className={styles.option}
                    aria-pressed={value === option}
                    onClick={() => onChange(spec.name, option)}
                  >
                    {option === "" ? "unset" : option}
                  </button>
                ))}
              </div>
            )}

            {spec.kind === "json" && (
              <textarea
                id={id}
                className={styles.textarea}
                rows={4}
                spellCheck={false}
                placeholder={spec.rawType}
                value={value}
                onChange={(e) => onChange(spec.name, e.target.value)}
              />
            )}

            {(spec.kind === "text" || spec.kind === "number" || spec.kind === "stringList") && (
              <input
                id={id}
                className={styles.input}
                inputMode={spec.kind === "number" ? "decimal" : undefined}
                spellCheck={false}
                placeholder={spec.kind === "stringList" ? "comma, separated, values" : undefined}
                value={value}
                onChange={(e) => onChange(spec.name, e.target.value)}
              />
            )}

            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
