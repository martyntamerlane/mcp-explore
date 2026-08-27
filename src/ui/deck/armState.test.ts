import { pressTool } from "./armState"

test("instant fires immediately and never arms", () => {
  expect(pressTool(null, "a", "instant")).toEqual({ armedId: null, fire: "a" })
  expect(pressTool("b", "a", "instant")).toEqual({ armedId: null, fire: "a" })
})

test("arm-class: first press arms, second fires, other tool re-arms", () => {
  expect(pressTool(null, "a", "arm")).toEqual({ armedId: "a", fire: null })
  expect(pressTool("a", "a", "arm")).toEqual({ armedId: null, fire: "a" })
  expect(pressTool("a", "b", "arm")).toEqual({ armedId: "b", fire: null })
})

test("input-required never fires and disarms", () => {
  expect(pressTool(null, "c", "input-required")).toEqual({ armedId: null, fire: null })
  expect(pressTool("a", "c", "input-required")).toEqual({ armedId: null, fire: null })
})
