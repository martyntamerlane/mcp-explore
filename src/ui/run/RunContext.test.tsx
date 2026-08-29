import { act, renderHook, waitFor } from "@testing-library/react"
import { expect, test, vi } from "vitest"
import type { Connection } from "../../mcp/types"
import { RunProvider, useRuns } from "./RunContext"
import { ReadProvider, useReads } from "./ReadContext"

function stubConnection(overrides: Record<string, unknown> = {}) {
  const callTool = vi.fn(async () => ({ content: [{ type: "text", text: "ok" }] }))
  const getPrompt = vi.fn(async () => ({ messages: [] }))
  const readResource = vi.fn(async () => ({ contents: [] }))
  const connection = {
    client: { callTool, getPrompt, readResource, ...overrides },
    transportKind: "in-memory",
    snapshot: { serverInfo: { name: "s", version: "1" }, capabilities: {}, tools: [], resources: [], prompts: [] },
    close: async () => {},
  } as unknown as Connection
  return { connection, callTool, getPrompt, readResource }
}

test("run passes arguments through to tools/call", async () => {
  const { connection, callTool } = stubConnection()
  const { result } = renderHook(() => useRuns(), {
    wrapper: ({ children }) => <RunProvider connection={connection}>{children}</RunProvider>,
  })

  act(() => result.current.run("create_issue", { title: "hi", limit: 5 }))

  await waitFor(() => expect(result.current.runs.create_issue?.records[0]?.display).toBeDefined())
  expect(callTool).toHaveBeenCalledWith(
    { name: "create_issue", arguments: { title: "hi", limit: 5 } },
    undefined,
    expect.objectContaining({ onprogress: expect.any(Function) }),
  )
})

test("run with no arguments sends an empty object", async () => {
  const { connection, callTool } = stubConnection()
  const { result } = renderHook(() => useRuns(), {
    wrapper: ({ children }) => <RunProvider connection={connection}>{children}</RunProvider>,
  })

  act(() => result.current.run("project_pulse"))

  await waitFor(() => expect(result.current.runs.project_pulse?.records[0]?.display).toBeDefined())
  expect(callTool).toHaveBeenCalledWith(
    { name: "project_pulse", arguments: {} },
    undefined,
    expect.objectContaining({ onprogress: expect.any(Function) }),
  )
})

test("a second run of the same tool while one is in flight is ignored", async () => {
  let release: (() => void) | undefined
  const callTool = vi.fn(
    () =>
      new Promise((resolve) => {
        release = () => resolve({ content: [{ type: "text", text: "ok" }] })
      }),
  )
  const { connection } = stubConnection({ callTool })
  const { result } = renderHook(() => useRuns(), {
    wrapper: ({ children }) => <RunProvider connection={connection}>{children}</RunProvider>,
  })

  act(() => result.current.run("slow"))
  act(() => result.current.run("slow"))
  expect(callTool).toHaveBeenCalledTimes(1)

  act(() => release?.())
  await waitFor(() => expect(result.current.runs.slow?.records[0]?.display).toBeDefined())
})

test("read passes prompt arguments through to prompts/get", async () => {
  const { connection, getPrompt } = stubConnection()
  const { result } = renderHook(() => useReads(), {
    wrapper: ({ children }) => <ReadProvider connection={connection}>{children}</ReadProvider>,
  })

  act(() => result.current.read("prompt", "triage_issue", { issue_id: "101" }))

  await waitFor(() => expect(result.current.reads["prompt:triage_issue"]?.status).toBe("done"))
  expect(getPrompt).toHaveBeenCalledWith({ name: "triage_issue", arguments: { issue_id: "101" } })
})

test("re-reading a prompt with different arguments fetches again", async () => {
  const { connection, getPrompt } = stubConnection()
  const { result } = renderHook(() => useReads(), {
    wrapper: ({ children }) => <ReadProvider connection={connection}>{children}</ReadProvider>,
  })

  act(() => result.current.read("prompt", "triage_issue", { issue_id: "101" }))
  await waitFor(() => expect(result.current.reads["prompt:triage_issue"]?.status).toBe("done"))
  act(() => result.current.read("prompt", "triage_issue", { issue_id: "102" }))

  await waitFor(() => expect(getPrompt).toHaveBeenCalledTimes(2))
  expect(getPrompt).toHaveBeenLastCalledWith({ name: "triage_issue", arguments: { issue_id: "102" } })
})
