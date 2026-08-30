import { useEffect } from "react"
import type { Resource } from "@modelcontextprotocol/sdk/types.js"
import { readKey, useReads } from "../run/ReadContext"
import { Elapsed, ReadBlocks } from "./blocks"
import ClampedText from "./ClampedText"
import Glyph from "./Glyph"
import styles from "./Workspace.module.css"

/**
 * A resource as the workspace's subject (tool-first workspace spec §6).
 * Selecting it is the load request; reads are cached for the session, so
 * returning to a resource is instant.
 */
export default function ResourceView({ resource }: { resource: Resource }) {
  const { reads, read } = useReads()
  const uri = resource.uri
  const state = reads[readKey("resource", uri)]

  useEffect(() => read("resource", uri), [read, uri])

  return (
    <>
      <div className={styles.subjectHead} data-kind="resource">
        <Glyph kind="resource" />
        <h2 className={styles.title}>{resource.name}</h2>
        {typeof resource.mimeType === "string" && <span className={styles.headBadge}>{resource.mimeType}</span>}
      </div>
      {resource.description && <ClampedText text={resource.description} lines={3} className={styles.description} />}
      <p className={styles.meta}>
        <code>{uri}</code>
      </p>

      <section className={styles.resultArea} aria-live="polite" aria-label="Contents">
        <p className={styles.microlabel}>CONTENTS</p>
        {state === undefined ? (
          <p className={styles.quiet}>Loading…</p>
        ) : state.status === "loading" ? (
          <p className={styles.quiet}>
            Loading… <Elapsed since={state.startedAt} />
          </p>
        ) : (
          <ReadBlocks display={state.display} />
        )}
      </section>
    </>
  )
}
