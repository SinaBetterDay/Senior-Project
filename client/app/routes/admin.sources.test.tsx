import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import Sources from "./admin.sources";

vi.mock("../adminComponents", () => ({ AdminGuard: ({ children }: { children: React.ReactNode }) => children, AdminNav: () => null }));
vi.mock("../components/CityAgendaDiscovery", () => ({ default: () => null }));
const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("../adminAuth", () => ({ adminFetch: mocks.fetch }));
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });
it("keeps the failed sync job message visible after refreshing sources", async () => {
  vi.useFakeTimers();
  mocks.fetch.mockImplementation(async (path: string, init?: RequestInit) => {
    if (init?.method === "POST") return Response.json({ syncLogId: "job-1" });
    if (path.includes("/sync/")) return Response.json({ status: "failed", error: "Agenda service rejected the API key." });
    return Response.json([{ id: "source-1", cityName: "Sacramento", sourceType: "legistar", lastSyncTime: null, totalAgendaItems: 0, lastError: null, status: "ready" }]);
  });
  await act(async () => { render(<Sources />); });
  fireEvent.click(screen.getByRole("button", { name: "Sync now" }));
  await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
  expect(screen.getByRole("alert")).toHaveTextContent("Agenda service rejected the API key.");
  const postsBefore = mocks.fetch.mock.calls.filter(([, init]) => init?.method === "POST").length;
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(mocks.fetch.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(postsBefore);
});