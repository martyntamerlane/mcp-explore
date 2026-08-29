import { render, screen } from "@testing-library/react"
import Markdown from "./Markdown"

// parse.test.ts covers the tree. These assert what actually reaches the DOM —
// in particular that nothing an untrusted server writes becomes markup or a
// network request.

test("renders structure as real elements", () => {
  const { container } = render(
    <Markdown text={"# Title\n\nSome **bold** text.\n\n- one\n- two\n\n```js\nconst a = 1\n```"} />,
  )
  expect(screen.getByRole("heading", { level: 3, name: "Title" })).toBeInTheDocument()
  expect(container.querySelector("strong")).toHaveTextContent("bold")
  expect(screen.getAllByRole("listitem")).toHaveLength(2)
  expect(container.querySelector("pre")).toHaveTextContent("const a = 1")
})

test("a table renders as a table", () => {
  render(<Markdown text={"| a | b |\n| --- | --- |\n| 1 | 2 |"} />)
  expect(screen.getByRole("table")).toBeInTheDocument()
  expect(screen.getByRole("columnheader", { name: "a" })).toBeInTheDocument()
  expect(screen.getByRole("cell", { name: "2" })).toBeInTheDocument()
})

test("safe links open in a new tab with the referrer withheld", () => {
  render(<Markdown text="[docs](https://example.com/x)" />)
  const link = screen.getByRole("link", { name: "docs" })
  expect(link).toHaveAttribute("href", "https://example.com/x")
  expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"))
  expect(link).toHaveAttribute("rel", expect.stringContaining("noreferrer"))
})

test("a javascript: URL never becomes a link", () => {
  const { container } = render(<Markdown text="[click](javascript:alert(1))" />)
  expect(container.querySelector("a")).toBeNull()
  expect(container.textContent).toBe("click")
})

test("HTML in the source never becomes markup", () => {
  const { container } = render(<Markdown text={'<img src=x onerror="alert(1)">\n\n<b>not bold</b>'} />)
  expect(container.querySelector("img")).toBeNull()
  expect(container.querySelector("b")).toBeNull()
  // The tag is dropped, its text kept (2026-08-29 reading pass). Before that
  // both lines rendered as literal angle brackets; the security property — that
  // no element is ever constructed from a server's markup — is unchanged.
  expect(container.textContent).toContain("not bold")
  expect(container.textContent).not.toContain("onerror")
})

test("a tag inside a sentence stays inert text", () => {
  const { container } = render(<Markdown text="use <b>bold</b> sparingly" />)
  expect(container.querySelector("b")).toBeNull()
  expect(container.textContent).toContain("use <b>bold</b> sparingly")
})

test("a remote image is never loaded — only offered as a link", () => {
  const { container } = render(<Markdown text="![a cat](https://tracker.example/pixel.png)" />)
  expect(container.querySelector("img")).toBeNull()
  expect(screen.getByRole("link", { name: /a cat/ })).toHaveAttribute("href", "https://tracker.example/pixel.png")
})

test("an image with an unsafe source is inert text", () => {
  const { container } = render(<Markdown text="![x](javascript:alert(1))" />)
  expect(container.querySelector("a")).toBeNull()
  expect(container.querySelector("img")).toBeNull()
  expect(container.textContent).toContain("x")
})
