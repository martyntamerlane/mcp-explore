import { useEffect } from "react"
import type { Resource } from "@modelcontextprotocol/sdk/types.js"
import { readKey, useReads } from "../run/ReadContext"
import { ReadBlocks } from "./blocks"
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
      <h2 className={styles.title}>{resource.name}</h2>
      {resource.description && <p className={styles.description}>{resource.description}</p>}
      <p className={styles.meta}>
        <code>{uri}</code>
        {typeof resource.mimeType === "string" && <span className={styles.metaSide}>{resource.mimeType}</span>}
      </p>

      <div className={styles.resultArea} aria-live="polite">
        <p className={styles.microlabel}>CONTENTS</p>
        {state === undefined || state.status === "loading" ? (
          <p className={styles.quiet}>Loading…</p>
        ) : (
          <ReadBlocks display={state.display} />
        )}
      </div>
    </>
  )
}
