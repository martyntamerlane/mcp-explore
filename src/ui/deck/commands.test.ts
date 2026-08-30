import {
  availableCommands,
  commandKey,
  commandQuery,
  isCommandQuery,
  matchCommands,
  runCommand,
  type Command,
  type CommandContext,
  type CommandHandlers,
} from "./commands"

const ctx = (over: Partial<CommandContext> = {}): CommandContext => ({
  hasSelection: true,
  mode: "light",
  raw: false,
  hasRenderable: true,
  ...over,
})

const ids = (list: Command[]) => list.map((c) => c.id)

test("`>` is the whole signal, and the query is what follows it", () => {
  expect(isCommandQuery(">")).toBe(true)
  expect(isCommandQuery(">copy")).toBe(true)
  expect(isCommandQuery("copy")).toBe(false)
  expect(isCommandQuery("")).toBe(false)
  // A filter looking for a name containing `>` is vanishingly rarer than the
  // command line, so the first character wins outright.
  expect(commandQuery(">")).toBe("")
  expect(commandQuery("> Copy Link ")).toBe("copy link")
})

test("home and copy link need somewhere to be", () => {
  expect(ids(availableCommands(ctx()))).toContain("home")
  expect(ids(availableCommands(ctx()))).toContain("copyLink")
  const atHome = ids(availableCommands(ctx({ hasSelection: false })))
  expect(atHome).not.toContain("home")
  expect(atHome).not.toContain("copyLink")
  // What is left still works from home, where nothing renders markdown either.
  expect(ids(availableCommands(ctx({ hasSelection: false, hasRenderable: false })))).toEqual([
    "toggleTheme",
    "disconnect",
  ])
})

test("raw and rendered are one row naming the direction it would travel", () => {
  expect(ids(availableCommands(ctx({ raw: false })))).toContain("showRaw")
  expect(ids(availableCommands(ctx({ raw: true })))).toContain("showRendered")
  expect(ids(availableCommands(ctx({ raw: true })))).not.toContain("showRaw")
  // Nothing rendered on screen means nothing to switch.
  expect(ids(availableCommands(ctx({ hasRenderable: false })))).not.toContain("showRaw")
})

test("the theme command names the mode it moves to, not the one you are in", () => {
  const label = (mode: "light" | "dark") => availableCommands(ctx({ mode })).find((c) => c.id === "toggleTheme")?.label
  expect(label("light")).toBe("Switch to dark mode")
  expect(label("dark")).toBe("Switch to light mode")
})

test("connect is not a second row — disconnect is the same code path and says so", () => {
  const list = availableCommands(ctx())
  const disconnect = list.find((c) => c.id === "disconnect")
  expect(disconnect?.hint).toBe("return to the connect screen")
  expect(matchCommands(list, "connect").map((c) => c.id)).toEqual(["disconnect"])
})

test("an empty query offers everything, in the order it was built", () => {
  const list = availableCommands(ctx())
  expect(matchCommands(list, "")).toEqual(list)
})

test("a prefix of the label beats a match in the middle of another word", () => {
  const list = availableCommands(ctx())
  // "Copy link…" starts with it; "Disconnect" merely contains it.
  expect(matchCommands(list, "co").map((c) => c.id)).toEqual(["copyLink", "disconnect"])
})

test("a later word in the label is reachable without typing the first", () => {
  const list = availableCommands(ctx())
  expect(matchCommands(list, "link").map((c) => c.id)).toEqual(["copyLink"])
})

test("keywords find a command the labels never name, and sort last", () => {
  const list = availableCommands(ctx({ mode: "light" }))
  // No label contains "theme"; only the keyword does.
  expect(matchCommands(list, "theme").map((c) => c.id)).toEqual(["toggleTheme"])
  // "s" prefixes the labels "Show raw" and "Switch to dark mode", and is only a
  // keyword of copy link ("share") and disconnect ("server") — so those follow.
  expect(matchCommands(list, "s").map((c) => c.id)).toEqual(["showRaw", "toggleTheme", "copyLink", "disconnect"])
})

test("a query matching nothing returns nothing rather than everything", () => {
  expect(matchCommands(availableCommands(ctx()), "zzz")).toEqual([])
})

test("only copy link needs a receipt — every other effect is visible on screen", () => {
  const withReceipt = availableCommands(ctx()).filter((c) => c.receipt !== undefined)
  expect(ids(withReceipt)).toEqual(["copyLink"])
})

test("command rows live in the keynav key space without colliding with entities", () => {
  expect(commandKey("home")).toBe("command:home")
  expect(commandKey("home")).not.toBe("leaf:tool:home")
})

test("every command dispatches to exactly one handler", () => {
  const calls: string[] = []
  const handlers: CommandHandlers = {
    home: () => calls.push("home"),
    copyLink: () => calls.push("copyLink"),
    setRaw: (raw) => calls.push(`setRaw:${raw}`),
    toggleTheme: () => calls.push("toggleTheme"),
    disconnect: () => calls.push("disconnect"),
  }
  runCommand("home", handlers)
  runCommand("copyLink", handlers)
  runCommand("showRaw", handlers)
  runCommand("showRendered", handlers)
  runCommand("toggleTheme", handlers)
  runCommand("disconnect", handlers)
  expect(calls).toEqual(["home", "copyLink", "setRaw:true", "setRaw:false", "toggleTheme", "disconnect"])
})
