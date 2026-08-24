import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import App from "./App"

test("Try the demo connects and shows the demo catalog", async () => {
  render(<App />)
  await userEvent.click(screen.getByRole("button", { name: /try the demo/i }))
  expect(await screen.findByText(/demo-issue-tracker/)).toBeInTheDocument()
  expect(screen.getByText("create_issue")).toBeInTheDocument()
  expect(screen.getByText("demo://readme")).toBeInTheDocument()
  expect(screen.getByText("weekly_summary")).toBeInTheDocument()
})
