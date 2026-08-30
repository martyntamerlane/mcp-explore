import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { HeadingRef } from "../markdown/parse"
import Outline from "./Outline"

/**
 * jsdom has no layout, so scroll-spy positions are not testable here — that half
 * was verified live (spec §7). What is testable is the part that decides whether
 * an entry is real: an outline may only link to a heading that exists.
 */
function renderOutline(entries: HeadingRef[], presentIds: string[]) {
  return render(
    <div data-scroller="">
      {presentIds.map((id) => (
        <h3 key={id} id={id}>
          {id}
        </h3>
      ))}
      <Outline entries={entries} />
    </div>,
  )
}

const entry = (id: string, level = 3): HeadingRef => ({ id, level, text: id.replace(/-/g, " ") })

test("the outline lists the headings that are on the page", async () => {
  renderOutline([entry("one"), entry("two"), entry("three")], ["one", "two", "three"])
  const nav = await screen.findByRole("navigation", { name: "Result outline" })
  expect(nav).not.toHaveAttribute("data-empty")
  expect(screen.getAllByRole("link").map((a) => a.textContent)).toEqual(["one", "two", "three"])
})

test("an entry whose heading is not rendered is dropped rather than linking nowhere", async () => {
  renderOutline([entry("one"), entry("gone"), entry("three")], ["one", "three"])
  await waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(2))
  expect(screen.queryByRole("link", { name: "gone" })).not.toBeInTheDocument()
})

test("an outline with nothing left to show stands down instead of unmounting", async () => {
  // It must stay in the DOM: it is what measures the document, and a component
  // that unmounts itself can never measure its way back.
  renderOutline([entry("gone")], [])
  const nav = await screen.findByRole("navigation", { name: "Result outline" })
  await waitFor(() => expect(nav).toHaveAttribute("data-empty"))
  expect(nav).toBeInTheDocument()
})

test("nesting is expressed as depth relative to the shallowest heading present", async () => {
  renderOutline([entry("a", 4), entry("b", 5), entry("c", 6), entry("d", 3)], ["a", "b", "c", "d"])
  await screen.findByRole("navigation", { name: "Result outline" })
  const depths = screen.getAllByRole("link").map((a) => a.getAttribute("data-depth"))
  // Shallowest present is 3, and depth is capped at two so a deep document stays legible.
  expect(depths).toEqual(["1", "2", "2", "0"])
})

test("clicking an entry scrolls its heading into view without touching history", async () => {
  const spy = vi.spyOn(Element.prototype, "scrollIntoView")
  const before = window.location.hash
  renderOutline([entry("one"), entry("two"), entry("three")], ["one", "two", "three"])
  await screen.findByRole("navigation", { name: "Result outline" })

  await userEvent.click(screen.getByRole("link", { name: "two" }))
  expect(spy).toHaveBeenCalledOnce()
  expect(spy.mock.instances[0]).toBe(document.getElementById("two"))
  // History belongs to selection (S1); a bare hash jump would add an entry.
  expect(window.location.hash).toBe(before)
  spy.mockRestore()
})
