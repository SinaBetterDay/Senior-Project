import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import Reports from "./admin.reports";

vi.mock("../adminComponents", () => ({ AdminGuard: ({ children }: { children: React.ReactNode }) => children, AdminNav: () => null }));
const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("../adminAuth", () => ({ adminFetch: mocks.fetch }));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

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

it("posts the selected scope and triggers a named browser download", async () => {
  mocks.fetch
    .mockResolvedValueOnce(Response.json({ data: [
      { id: "official-1", name: "Alex Rivera", city: "Oakland" },
      { id: "official-2", name: "Jordan Lee", city: "San Jose" },
    ] }))
    .mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'attachment; filename="fair-conflict-report-2026-10-11.pdf"' },
      blob: async () => ({ type: "application/pdf" }),
    });
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn(() => "blob:fair-report"),
    revokeObjectURL: vi.fn(),
  });
  const downloadClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

  await act(async () => { render(<Reports />); });
  fireEvent.click(screen.getByRole("radio", { name: /City/ }));
  fireEvent.change(screen.getByLabelText("City"), { target: { value: "Oakland" } });
  fireEvent.click(screen.getByRole("button", { name: "Download PDF" }));

  await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2));
  expect(mocks.fetch.mock.calls[1][0]).toBe("/api/admin/reports/pdf");
  expect(JSON.parse(mocks.fetch.mock.calls[1][1].body)).toEqual({ scope: "city", city: "Oakland" });
  expect(downloadClick).toHaveBeenCalledOnce();
  expect(downloadClick.mock.instances[0]).toHaveProperty("download", "fair-conflict-report-2026-10-11.pdf");
});