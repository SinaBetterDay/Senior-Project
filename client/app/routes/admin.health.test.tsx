import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminHealthPage from "./admin.health";

const { adminFetchMock } = vi.hoisted(() => ({
  adminFetchMock: vi.fn(),
}));

vi.mock("../adminAuth", () => ({
  adminFetch: adminFetchMock,
}));

vi.mock("../adminComponents", () => ({
  AdminGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  AdminNav: ({ title }: { title: string }) => <header>{title}</header>,
}));

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const healthData = {
  runs: [
    {
      id: "run-1",
      source: "Sacramento",
      sourceType: "legistar",
      startedAt: "2026-11-08T02:00:00.000Z",
      completedAt: "2026-11-08T02:05:00.000Z",
      status: "success",
      itemsFound: 10,
      itemsInserted: 4,
      itemsSkipped: 6,
      conflictsDetected: 2,
      error: null,
      retryEligible: false,
    },
    {
      id: "run-2",
      source: "Elk Grove",
      sourceType: "apify",
      startedAt: "2026-11-07T03:00:00.000Z",
      completedAt: "2026-11-07T03:10:00.000Z",
      status: "failed",
      itemsFound: 5,
      itemsInserted: 0,
      itemsSkipped: 5,
      conflictsDetected: 0,
      error: "Actor failed safely",
      retryEligible: true,
    },
  ],
  detectionRuns: [
    {
      id: "run-1-detection",
      source: "Sacramento",
      startedAt: "2026-11-08T02:00:00.000Z",
      completedAt: "2026-11-08T02:05:00.000Z",
      status: "success",
      candidates: 4,
      conflictsDetected: 2,
      error: null,
    },
  ],
  lastSuccessful: {
    legistar: {
      source: "Sacramento",
      completedAt: "2026-11-08T02:05:00.000Z",
    },
    apify: null,
  },
  runningJobs: [],
  rowCounts: {
    agendaItems: 4,
    conflicts: 6,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  adminFetchMock.mockResolvedValue(jsonResponse(healthData));
});

describe("AdminHealthPage", () => {
  it("displays sync and detection status information", async () => {
    render(<AdminHealthPage />);

    expect(
       await screen.findByRole("heading", { name: "Recent sync runs" }),
     ).toBeInTheDocument();   
      
    expect(screen.getAllByText("Success").length).toBeGreaterThan(0);
    expect(screen.getByText("Actor failed safely")).toBeInTheDocument();
    expect(screen.getByText("Recent detection runs")).toBeInTheDocument();
    expect(screen.getByText("Last successful legistar run")).toBeInTheDocument();
  });

  it("supports manual refresh", async () => {
    render(<AdminHealthPage />);

    await screen.findByRole("button", { name: "Refresh" });
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => {
      expect(adminFetchMock).toHaveBeenCalledTimes(2);
    });
  });

  it("retries an eligible failed run", async () => {
    adminFetchMock
      .mockResolvedValueOnce(jsonResponse(healthData))
      .mockResolvedValueOnce(
        jsonResponse({ id: "retry-1", status: "running" }, 202),
      )
      .mockResolvedValueOnce(jsonResponse(healthData));

    render(<AdminHealthPage />);

    await screen.findByRole("button", { name: "Retry" });

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(adminFetchMock).toHaveBeenCalledWith(
        "/api/admin/health/runs/run-2/retry",
        { method: "POST" },
      );
    });

    expect(adminFetchMock).toHaveBeenCalledTimes(3);
  });
});