import { loadRecents, saveRecent } from "./recents"

beforeEach(() => localStorage.clear())

test("returns empty list when nothing stored or storage is corrupt", () => {
  expect(loadRecents()).toEqual([])
  localStorage.setItem("mcp-explore:recents", "{not json")
  expect(loadRecents()).toEqual([])
})

test("saves to the front, dedupes by url, caps at 8", () => {
  for (let i = 0; i < 9; i++) saveRecent({ url: `https://s${i}.example` }, i)
  let list = loadRecents()
  expect(list).toHaveLength(8)
  expect(list[0].url).toBe("https://s8.example")
  saveRecent({ url: "https://s3.example" }, 100)
  list = loadRecents()
  expect(list[0].url).toBe("https://s3.example")
  expect(list.filter((r) => r.url === "https://s3.example")).toHaveLength(1)
})

test("stores headers only when provided and non-empty", () => {
  saveRecent({ url: "https://a.example", headers: {} }, 1)
  saveRecent({ url: "https://b.example", headers: { Authorization: "Bearer x" } }, 2)
  const byUrl = Object.fromEntries(loadRecents().map((r) => [r.url, r]))
  expect(byUrl["https://a.example"].headers).toBeUndefined()
  expect(byUrl["https://b.example"].headers).toEqual({ Authorization: "Bearer x" })
})

test("saveRecent tolerates storage write failures and still returns the computed list", () => {
  const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("QuotaExceededError")
  })
  try {
    let list: ReturnType<typeof saveRecent> = []
    expect(() => {
      list = saveRecent({ url: "https://locked.example" }, 1)
    }).not.toThrow()
    expect(list.some((r) => r.url === "https://locked.example")).toBe(true)
  } finally {
    setItemSpy.mockRestore()
  }
})

test("a tampered entry keeps its usable parts and drops the rest", () => {
  // localStorage is user-editable, so stored entries are untrusted input.
  localStorage.setItem(
    "mcp-explore:recents",
    JSON.stringify([
      { url: "https://a.example/mcp", headers: { Good: "yes", Bad: 42, Worse: { nested: true } }, lastUsed: 5 },
      { url: "https://b.example/mcp", headers: ["not", "an", "object"], lastUsed: "not a number" },
      { url: "", lastUsed: 1 },
      { lastUsed: 1 },
      "not an object",
      null,
    ]),
  )
  const recents = loadRecents()
  expect(recents.map((r) => r.url)).toEqual(["https://a.example/mcp", "https://b.example/mcp"])
  // Only the string-valued header survives — the entry itself is still usable.
  expect(recents[0].headers).toEqual({ Good: "yes" })
  expect(recents[0].lastUsed).toBe(5)
  // An array is not a headers object, and a non-numeric lastUsed falls back to 0.
  expect(recents[1].headers).toBeUndefined()
  expect(recents[1].lastUsed).toBe(0)
})
