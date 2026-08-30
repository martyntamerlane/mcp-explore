import {
  LABEL_VALUE_BUDGET,
  MAX_HISTORY,
  MAX_LABEL_CHARS,
  MIN_VALUE_CHARS,
  elapsedLabel,
  isRunning,
  progressLabel,
  progressRun,
  recordsOf,
  runLabel,
  settleRun,
  startRun,
  viewRun,
  viewedRecord,
  type Runs,
} from "./runHistory"

const ok = { ok: true, blocks: [{ text: "answer" }], truncated: false }
const bad = { ok: false, blocks: [{ text: "boom" }], truncated: false }

test("a run becomes the newest record and the one on screen", () => {
  let runs: Runs = {}
  runs = startRun(runs, "ask", 1, { q: "a" }, 1000)
  expect(recordsOf(runs, "ask")).toHaveLength(1)
  expect(isRunning(runs, "ask")).toBe(true)
  expect(viewedRecord(runs, "ask")?.id).toBe(1)

  runs = settleRun(runs, "ask", 1, ok, 1500)
  expect(isRunning(runs, "ask")).toBe(false)
  expect(viewedRecord(runs, "ask")?.display).toEqual(ok)
  expect(viewedRecord(runs, "ask")?.endedAt).toBe(1500)
})

test("running a tool again keeps the previous answer", () => {
  let runs: Runs = startRun({}, "ask", 1, { q: "a" }, 1000)
  runs = settleRun(runs, "ask", 1, ok, 1100)
  runs = startRun(runs, "ask", 2, { q: "b" }, 2000)
  runs = settleRun(runs, "ask", 2, bad, 2100)

  const records = recordsOf(runs, "ask")
  expect(records.map((r) => r.id)).toEqual([2, 1])
  expect(records.map((r) => r.args)).toEqual([{ q: "b" }, { q: "a" }])
  // Failures join the history — the failures are what you want to compare.
  expect(records[0].display).toEqual(bad)
  expect(records[1].display).toEqual(ok)
})

test("a new run is what you are looking at, even after browsing an old one", () => {
  let runs: Runs = settleRun(startRun({}, "ask", 1, {}, 1), "ask", 1, ok, 2)
  runs = settleRun(startRun(runs, "ask", 2, {}, 3), "ask", 2, ok, 4)
  runs = viewRun(runs, "ask", 1)
  expect(viewedRecord(runs, "ask")?.id).toBe(1)
  runs = startRun(runs, "ask", 3, {}, 5)
  expect(viewedRecord(runs, "ask")?.id).toBe(3)
})

test("the history caps, dropping the oldest first", () => {
  let runs: Runs = {}
  for (let i = 1; i <= MAX_HISTORY + 4; i++) {
    runs = settleRun(startRun(runs, "ask", i, { n: i }, i), "ask", i, ok, i)
  }
  const records = recordsOf(runs, "ask")
  expect(records).toHaveLength(MAX_HISTORY)
  expect(records[0].id).toBe(MAX_HISTORY + 4)
  expect(records[records.length - 1].id).toBe(5)
})

test("viewing an id the cap has dropped is ignored rather than blanking the region", () => {
  let runs: Runs = {}
  for (let i = 1; i <= MAX_HISTORY + 1; i++) {
    runs = settleRun(startRun(runs, "ask", i, {}, i), "ask", i, ok, i)
  }
  const before = viewedRecord(runs, "ask")?.id
  runs = viewRun(runs, "ask", 1)
  expect(viewedRecord(runs, "ask")?.id).toBe(before)
})

test("a settle for a record the cap has dropped changes nothing", () => {
  let runs: Runs = {}
  for (let i = 1; i <= MAX_HISTORY + 1; i++) runs = startRun(runs, "ask", i, {}, i)
  runs = settleRun(runs, "ask", 1, ok, 99)
  expect(recordsOf(runs, "ask").some((r) => r.display !== undefined)).toBe(false)
})

test("tools keep separate histories", () => {
  let runs: Runs = startRun({}, "a", 1, {}, 1)
  runs = startRun(runs, "b", 2, {}, 2)
  expect(recordsOf(runs, "a")).toHaveLength(1)
  expect(recordsOf(runs, "b")).toHaveLength(1)
  expect(isRunning(runs, "c")).toBe(false)
  expect(viewedRecord(runs, "c")).toBeNull()
  expect(recordsOf(runs, "c")).toEqual([])
})

test("progress lands on its own record", () => {
  let runs: Runs = startRun({}, "ask", 1, {}, 1)
  runs = startRun(runs, "other", 2, {}, 1)
  runs = progressRun(runs, "ask", 1, { progress: 3, total: 10 })
  expect(recordsOf(runs, "ask")[0].progress).toEqual({ progress: 3, total: 10 })
  expect(recordsOf(runs, "other")[0].progress).toBeUndefined()
})

/* ── labelling ── */

test("a run is labelled by its arguments", () => {
  expect(runLabel({})).toBe("no arguments")
  expect(runLabel({ q: "why", limit: 5 })).toBe("q: why · limit: 5")
  expect(runLabel({ tags: ["a", "b"] })).toBe('tags: ["a","b"]')
  expect(runLabel({ on: true })).toBe("on: true")
})

test("a long argument truncates rather than pretending to be complete", () => {
  const label = runLabel({ question: "x".repeat(300) })
  expect(label).toBe("question: " + "x".repeat(LABEL_VALUE_BUDGET - 1) + "…")
})

test("two long arguments share the budget, so the one that differs stays visible", () => {
  const repo = "modelcontextprotocol/typescript-sdk"
  const a = runLabel({ repoName: [repo], question: "What transports does the client support?" })
  const b = runLabel({ repoName: [repo], question: "How does session resumption work?" })
  expect(a).not.toBe(b)
  expect(a).toContain("What transports")
  expect(b).toContain("How does session")
})

test("many arguments still show something of each, under a hard ceiling", () => {
  const args = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${i}`, "v".repeat(50)]))
  const label = runLabel(args)
  expect(label.length).toBeLessThanOrEqual(MAX_LABEL_CHARS)
  expect(label).toContain("k0: " + "v".repeat(MIN_VALUE_CHARS - 1) + "…")
})

test("labelling survives values a JSON field could have produced", () => {
  const cyclic: Record<string, unknown> = {}
  cyclic.self = cyclic
  expect(() => runLabel({ v: cyclic })).not.toThrow()
  expect(() => runLabel({ v: undefined })).not.toThrow()
})

test("elapsed keeps a decimal while it is short, so the number visibly moves", () => {
  expect(elapsedLabel(0)).toBe("0.0s")
  expect(elapsedLabel(400)).toBe("0.4s")
  expect(elapsedLabel(9900)).toBe("9.9s")
  expect(elapsedLabel(14_000)).toBe("14s")
  expect(elapsedLabel(65_000)).toBe("1m 05s")
  expect(elapsedLabel(-5)).toBe("0.0s")
})

test("progress is only a percentage when the server said what the total was", () => {
  expect(progressLabel(undefined)).toBeUndefined()
  expect(progressLabel({ progress: 3, total: 10 })).toBe("30%")
  expect(progressLabel({ progress: 3 })).toBe("step 3")
  expect(progressLabel({ progress: 3, total: 0 })).toBe("step 3")
  expect(progressLabel({ progress: 3, total: 10, message: "indexing" })).toBe("30% — indexing")
  expect(progressLabel({ progress: 3, message: "  " })).toBe("step 3")
})
