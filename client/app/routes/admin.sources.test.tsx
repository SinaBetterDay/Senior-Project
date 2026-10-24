import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

it("loads and submits the agenda archive URL when editing an Apify source", async () => {
  const source = {
    id: "source-1", cityName: "City of Calexico", sourceType: "apify", apifyActorId: "actor-id",
    startUrl: "https://www.calexico.ca.gov/councilagendas", lastSyncTime: null, totalAgendaItems: 0,
    lastError: null, status: "ready",
  };
  mocks.fetch.mockImplementation(async (_path: string, init?: RequestInit) => (
    init?.method === "PUT" ? Response.json(source) : Response.json([source])
  ));
  const user = userEvent.setup();

  render(<Sources />);
  expect(await screen.findByText("City of Calexico")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Edit City of Calexico source" }));
  expect(screen.getByLabelText("Agenda archive URL")).toHaveValue("https://www.calexico.ca.gov/councilagendas");
  await user.click(screen.getByRole("button", { name: "Save changes" }));

  const request = mocks.fetch.mock.calls.find(([, init]) => init?.method === "PUT");
  expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({
    apifyActorId: "actor-id",
    startUrl: "https://www.calexico.ca.gov/councilagendas",
  });
});