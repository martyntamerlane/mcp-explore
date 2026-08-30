import { flattenNav, foldersTo, keyAction, leafKey, moveActive, type NavNode, type NavRow } from "./keynav"

const leaf = (id: string): NavNode => ({ type: "leaf", item: { kind: "resource", id, label: id } })
const folder = (path: string, children: NavNode[]): NavNode => ({
  type: "folder",
  name: path,
  path,
  children,
  count: children.length,
})

const tree: NavNode[] = [folder("docs", [leaf("a"), leaf("b")]), leaf("c")]

const flat = (nodes: NavNode[], open: string[] = [], query = "") =>
  flattenNav(nodes, {
    isOpen: (p) => open.includes(p),
    matches: (label) => query === "" || label.includes(query),
    queryActive: query !== "",
  })

const keys = (rows: NavRow[]) => rows.map((r) => r.key)

test("a closed folder hides its children from the keyboard too", () => {
  expect(keys(flat(tree))).toEqual(["folder:docs", leafKey("resource", "c")])
  expect(keys(flat(tree, ["docs"]))).toEqual([
    "folder:docs",
    leafKey("resource", "a"),
    leafKey("resource", "b"),
    leafKey("resource", "c"),
  ])
})

test("an active filter forces every folder open and recedes what does not match", () => {
  const rows = flat(tree, [], "a")
  expect(keys(rows)).toEqual([
    "folder:docs",
    leafKey("resource", "a"),
    leafKey("resource", "b"),
    leafKey("resource", "c"),
  ])
  expect(rows.map((r) => r.receded)).toEqual([false, false, true, true])
})

test("a folder recedes only when nothing beneath it matches", () => {
  const rows = flat([folder("docs", [leaf("a")]), folder("other", [leaf("z")])], [], "a")
  expect(rows.filter((r) => r.type === "folder").map((r) => r.receded)).toEqual([false, true])
})

test("movement skips receded rows and clamps at both ends", () => {
  const rows = flat(tree, ["docs"], "a")
  // Only the folder and leaf "a" survive the filter.
  expect(moveActive(rows, null, 1)).toBe("folder:docs")
  expect(moveActive(rows, "folder:docs", 1)).toBe(leafKey("resource", "a"))
  expect(moveActive(rows, leafKey("resource", "a"), 1)).toBe(leafKey("resource", "a"))
  expect(moveActive(rows, "folder:docs", -1)).toBe("folder:docs")
})

test("↑ from nowhere enters at the bottom, ↓ from nowhere at the top", () => {
  const rows = flat(tree, ["docs"])
  expect(moveActive(rows, null, -1)).toBe(leafKey("resource", "c"))
  expect(moveActive(rows, null, 1)).toBe("folder:docs")
})

test("a highlight on a row the filter just hid restarts rather than sticking", () => {
  const rows = flat(tree, ["docs"], "a")
  expect(moveActive(rows, leafKey("resource", "b"), 1)).toBe("folder:docs")
})

test("an empty list has nothing to highlight", () => {
  expect(moveActive([], null, 1)).toBeNull()
  expect(moveActive(flat(tree, [], "zzz"), null, 1)).toBeNull()
})

const press = (key: string, ctx: Partial<Parameters<typeof keyAction>[1]> = {}) =>
  keyAction(
    { key, altKey: false, ctrlKey: false, metaKey: false },
    { inTextField: false, inFilter: false, inListButton: false, queryActive: false, ...ctx },
  )

test("the list keys work from nowhere in particular", () => {
  expect(press("/")).toEqual({ type: "focusFilter" })
  expect(press("ArrowDown")).toEqual({ type: "move", delta: 1 })
  expect(press("ArrowUp")).toEqual({ type: "move", delta: -1 })
  expect(press("Enter")).toEqual({ type: "commit" })
  expect(press("ArrowRight")).toEqual({ type: "openFolder" })
  expect(press("ArrowLeft")).toEqual({ type: "closeFolder" })
  expect(press("x")).toBeNull()
})

test("a tool's argument field keeps every keystroke except Escape", () => {
  const field = { inTextField: true }
  expect(press("/", field)).toBeNull()
  expect(press("ArrowDown", field)).toBeNull()
  expect(press("Enter", field)).toBeNull()
  expect(press("ArrowLeft", field)).toBeNull()
  expect(press("Escape", field)).toEqual({ type: "home" })
})

test("the filter drives the list with ↑↓⏎ but keeps its own caret on ←→", () => {
  const filter = { inTextField: true, inFilter: true }
  expect(press("ArrowDown", filter)).toEqual({ type: "move", delta: 1 })
  expect(press("Enter", filter)).toEqual({ type: "commit" })
  expect(press("ArrowLeft", filter)).toBeNull()
  expect(press("ArrowRight", filter)).toBeNull()
  // `/` in the filter is a slash, not a shortcut.
  expect(press("/", filter)).toBeNull()
})

test("a focused row button commits itself, so ⏎ is left alone", () => {
  expect(press("Enter", { inListButton: true })).toBeNull()
  expect(press("ArrowDown", { inListButton: true })).toEqual({ type: "move", delta: 1 })
})

test("Escape unwinds the filter first and the subject second", () => {
  expect(press("Escape", { queryActive: true })).toEqual({ type: "clearFilter" })
  expect(press("Escape")).toEqual({ type: "home" })
})

test("a modified keystroke belongs to the browser", () => {
  for (const mod of ["altKey", "ctrlKey", "metaKey"] as const) {
    expect(keyAction(
      { key: "ArrowDown", altKey: false, ctrlKey: false, metaKey: false, [mod]: true },
      { inTextField: false, inFilter: false, inListButton: false, queryActive: false },
    )).toBeNull()
  }
})

test("foldersTo names every folder on the way down to a leaf", () => {
  const deep: NavNode[] = [folder("a", [folder("a/b", [leaf("deep")]), leaf("shallow")]), leaf("top")]
  expect(foldersTo(deep, leafKey("resource", "deep"))).toEqual(["a", "a/b"])
  expect(foldersTo(deep, leafKey("resource", "shallow"))).toEqual(["a"])
  expect(foldersTo(deep, leafKey("resource", "top"))).toEqual([])
  expect(foldersTo(deep, leafKey("resource", "absent"))).toEqual([])
})
