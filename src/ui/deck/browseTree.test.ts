import type { BrowseItem } from "./deckModel"
import { buildBrowseTree, type BrowseNode } from "./browseTree"

const res = (uri: string, label = uri.split("/").pop() ?? uri): BrowseItem => ({
  kind: "resource",
  id: uri,
  label,
})

const shape = (nodes: BrowseNode[]): unknown =>
  nodes.map((n) => (n.type === "folder" ? { [n.name]: shape(n.children) } : n.item.id))

test("flat URIs render as flat leaves in server order", () => {
  const tree = buildBrowseTree([res("demo://config"), res("demo://readme")])
  expect(shape(tree)).toEqual(["demo://config", "demo://readme"])
})

test("folders materialise at >= 2 entries, folders first, loose leaves keep order", () => {
  const tree = buildBrowseTree([
    res("demo://config"),
    res("demo://docs/getting-started"),
    res("demo://issues/101"),
    res("demo://issues/102"),
    res("demo://docs/writing-good-issues"),
    res("demo://readme"),
  ])
  expect(shape(tree)).toEqual([
    { docs: ["demo://docs/getting-started", "demo://docs/writing-good-issues"] },
    { issues: ["demo://issues/101", "demo://issues/102"] },
    "demo://config",
    "demo://readme",
  ])
})

test("a lone deep path is hoisted flat — no single-entry folders", () => {
  const tree = buildBrowseTree([res("demo://a/b/c/file"), res("demo://top")])
  expect(shape(tree)).toEqual(["demo://a/b/c/file", "demo://top"])
})

test("single-child folder chains collapse into one segment path", () => {
  const tree = buildBrowseTree([res("hf://datasets/glue/x"), res("hf://datasets/glue/y")])
  expect(shape(tree)).toEqual([{ "datasets/glue": ["hf://datasets/glue/x", "hf://datasets/glue/y"] }])
})

test("sub-folders below the threshold hoist their leaf into the parent folder", () => {
  const tree = buildBrowseTree([
    res("hf://datasets/glue/README"),
    res("hf://datasets/squad/README"),
    res("hf://models/bert"),
  ])
  expect(shape(tree)).toEqual([
    { datasets: ["hf://datasets/glue/README", "hf://datasets/squad/README"] },
    "hf://models/bert",
  ])
})

test("one shared scheme is not a folder; mixed schemes become top-level folders", () => {
  const single = buildBrowseTree([res("demo://config"), res("demo://readme")])
  expect(single.every((n) => n.type === "leaf")).toBe(true)

  const mixed = buildBrowseTree([res("demo://config"), res("file://a/x"), res("file://a/y")])
  expect(shape(mixed)).toEqual([{ "file://": [{ a: ["file://a/x", "file://a/y"] }] }, "demo://config"])
})

test("folder count is its leaf-descendant total", () => {
  const tree = buildBrowseTree([res("d://docs/a"), res("d://docs/b"), res("d://docs/deep/c"), res("d://docs/deep/e")])
  const docs = tree[0]
  expect(docs.type).toBe("folder")
  if (docs.type === "folder") {
    expect(docs.count).toBe(4)
    const deep = docs.children.find((n) => n.type === "folder")
    expect(deep && deep.type === "folder" && deep.count).toBe(2)
  }
})

test("schemeless and malformed URIs never throw and stay leaves", () => {
  const tree = buildBrowseTree([res("just-a-name"), res(""), res("odd:///"), res("a b c://x")])
  expect(tree).toHaveLength(4)
  expect(tree.every((n) => n.type === "leaf")).toBe(true)
})
