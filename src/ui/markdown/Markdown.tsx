import { createElement, Fragment, type ReactNode } from "react"
import { parseDocument, type Block, type Inline } from "./parse"
import styles from "./Markdown.module.css"

/**
 * Renders the parser's tree as React elements. Every string from the server
 * arrives here as a text node or an attribute value React escapes — there is no
 * dangerouslySetInnerHTML in this file and there must never be one (CLAUDE.md
 * security rules). Swapping in a markdown library later means replacing this
 * component and parse.ts and nothing else.
 */

function renderInline(nodes: Inline[]): ReactNode {
  return nodes.map((n, i) => {
    switch (n.type) {
      case "text":
        return <Fragment key={i}>{n.value}</Fragment>
      case "code":
        return (
          <code key={i} className={styles.code}>
            {n.value}
          </code>
        )
      case "strong":
        return <strong key={i}>{renderInline(n.children)}</strong>
      case "em":
        return <em key={i}>{renderInline(n.children)}</em>
      case "del":
        return <del key={i}>{renderInline(n.children)}</del>
      case "link":
        return (
          <a key={i} className={styles.link} href={n.href} target="_blank" rel="noopener noreferrer nofollow">
            {renderInline(n.children)}
          </a>
        )
      case "image":
        // Never an <img>: loading a remote image would send this visitor's IP
        // and a referrer to a third party chosen by the server being inspected.
        // The reference is offered as a link the user can choose to follow.
        return n.href === null ? (
          <span key={i} className={styles.imageRef}>
            {n.alt || "image"}
          </span>
        ) : (
          <a
            key={i}
            className={`${styles.link} ${styles.imageRef}`}
            href={n.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
          >
            {n.alt || n.href}
          </a>
        )
    }
  })
}

function renderBlocks(blocks: Block[]): ReactNode {
  return blocks.map((b, i) => {
    switch (b.type) {
      case "heading":
        // The id is the outline's anchor; parseDocument stamped it (TODO-29).
        return createElement(
          `h${b.level}`,
          { key: i, id: b.id, className: styles.heading },
          renderInline(b.children),
        )
      case "paragraph":
        return (
          <p key={i} className={styles.paragraph}>
            {renderInline(b.children)}
          </p>
        )
      case "code":
        return (
          <pre key={i} className={styles.pre}>
            {b.value}
          </pre>
        )
      case "rule":
        return <hr key={i} className={styles.rule} />
      case "quote":
        return (
          <blockquote key={i} className={styles.quote}>
            {renderBlocks(b.children)}
          </blockquote>
        )
      case "list":
        return b.ordered ? (
          <ol key={i} className={styles.list} start={b.start}>
            {b.items.map((item, j) => (
              <li key={j}>{renderBlocks(item)}</li>
            ))}
          </ol>
        ) : (
          <ul key={i} className={styles.list}>
            {b.items.map((item, j) => (
              <li key={j}>{renderBlocks(item)}</li>
            ))}
          </ul>
        )
      case "table":
        return (
          <div key={i} className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {b.head.map((cell, c) => (
                    <th key={c} style={b.align[c] ? { textAlign: b.align[c]! } : undefined}>
                      {renderInline(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((cell, c) => (
                      <td key={c} style={b.align[c] ? { textAlign: b.align[c]! } : undefined}>
                        {renderInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
    }
  })
}

export default function Markdown({ text, idPrefix = "" }: { text: string; idPrefix?: string }) {
  return <div className={styles.md}>{renderBlocks(parseDocument(text, idPrefix))}</div>
}
