import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import Conflicts from "./conflicts";
import Politicians from "./politicians";
import ConflictDetail from "./conflicts.$id";
import PoliticianDetail from "./politician-detail";
import AgendaDetail from "./agenda-detail";
import Profile from "./politician.profile";
import { Welcome } from "../welcome/welcome";
import { TIMEOUT_MESSAGE } from "../lib/request";

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
const record = { id: "1", politicianName: "Jordan Lee", city: "Sacramento", conflictType: "INCOME", severity: "HIGH", agendaItemSummary: "Contract review", detectedAt: "2026-10-01" };

describe("public request recovery", () => {
  it.each([Conflicts, Politicians, ConflictDetail, PoliticianDetail, AgendaDetail, Welcome, Profile])("provides a timeout and retry on route %#", async Page => {
    vi.useFakeTimers();
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise(() => {}));
    render(<MemoryRouter><Page /></MemoryRouter>);
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(screen.getByRole("alert")).toHaveTextContent(TIMEOUT_MESSAGE);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("shows essential conflict columns and resets an empty filter", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ data: [record] }));
    render(<MemoryRouter><Conflicts /></MemoryRouter>);
    expect(await screen.findByRole("cell", { name: "Jordan Lee" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Severity" })).not.toHaveClass("hidden");
    expect(screen.getByRole("link", { name: "View details for Jordan Lee" })).toHaveAttribute("href", "/conflicts/1");
    fireEvent.change(screen.getByLabelText("Severity"), { target: { value: "LOW" } });
    expect(screen.getByText("No records match these filters")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(screen.getByRole("cell", { name: "Jordan Lee" })).toBeInTheDocument();
  });
  it("recovers from a server failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json({}, { status: 500 })).mockResolvedValueOnce(Response.json({ data: [record] }));
    render(<MemoryRouter><Conflicts /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("cell", { name: "Jordan Lee" })).toBeInTheDocument();
  });
});