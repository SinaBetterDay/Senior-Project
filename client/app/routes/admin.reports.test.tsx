import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import Reports from "./admin.reports";

vi.mock("../adminComponents", () => ({ AdminGuard: ({ children }: { children: React.ReactNode }) => children, AdminNav: () => null }));
const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("../adminAuth", () => ({ adminFetch: mocks.fetch }));

it("offers all conflict scopes and the matching filter controls", async () => {
  mocks.fetch.mockResolvedValue(Response.json({ data: [
    { id: "official-1", name: "Alex Rivera", city: "Oakland" },
    { id: "official-2", name: "Jordan Lee", city: "San Jose" },
    { id: "official-3", name: "Sam Kim", city: "Oakland" },
  ] }));

  await act(async () => { render(<Reports />); });
  expect(mocks.fetch).toHaveBeenCalledWith("/api/admin/politicians");
  expect(screen.getByRole("radio", { name: /All conflicts/ })).toBeChecked();
  expect(screen.getByText("Selected scope").parentElement).toHaveTextContent("All conflicts");

  fireEvent.click(screen.getByRole("radio", { name: /Politician/ }));
  expect(screen.getByLabelText("Politician")).toHaveTextContent("Alex Rivera · Oakland");
  fireEvent.change(screen.getByLabelText("Politician"), { target: { value: "official-1" } });
  expect(screen.getByText("Selected scope").parentElement).toHaveTextContent("Alex Rivera");

  fireEvent.click(screen.getByRole("radio", { name: /City/ }));
  expect(screen.getByLabelText("City")).toHaveTextContent("Oakland");
  expect(screen.getByLabelText("City").querySelectorAll("option")).toHaveLength(3);

  fireEvent.click(screen.getByRole("radio", { name: /Date range/ }));
  expect(screen.getByLabelText("Start date")).toHaveAttribute("type", "date");
  expect(screen.getByLabelText("End date")).toHaveAttribute("type", "date");
});