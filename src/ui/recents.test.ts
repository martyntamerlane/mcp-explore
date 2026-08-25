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
