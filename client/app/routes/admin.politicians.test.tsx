import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import AdminPoliticiansPage from "./admin.politicians";

vi.mock("../adminComponents", () => ({ AdminGuard: ({ children }: { children: React.ReactNode }) => children, AdminNav: () => null }));
const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("../adminAuth", () => ({ adminFetch: mocks.fetch }));
afterEach(() => vi.clearAllMocks());

const politicians = [
  { id: "11111111-1111-4111-8111-111111111111", slug: "jane-smyth", name: "Jane Smyth", officeTitle: "Councilmember", district: "1", city: "Sacramento", needsReview: true, filingCount: 1 },
  { id: "22222222-2222-4222-8222-222222222222", slug: "jane-smith", name: "Jane Smith", officeTitle: "Councilmember", district: "1", city: "Sacramento", needsReview: false, filingCount: 2 },
];

it("approves a needs-review politician", async () => {
  mocks.fetch.mockImplementation(async (_path: string, init?: RequestInit) => init?.method === "POST" ? Response.json({ data: { needsReview: false } }) : Response.json({ data: politicians }));
  const user = userEvent.setup(); render(<AdminPoliticiansPage />);
  await user.click(await screen.findByRole("button", { name: "Approve Jane Smyth" }));
  expect(mocks.fetch).toHaveBeenCalledWith(expect.stringContaining("/approve"), { method: "POST" });
  expect(await screen.findByRole("status")).toHaveTextContent("Jane Smyth was approved");
});

it("submits a selected surviving profile for reconciliation", async () => {
  mocks.fetch.mockImplementation(async (_path: string, init?: RequestInit) => init?.method === "POST" ? Response.json({ message: "Jane Smyth was reconciled into Jane Smith." }) : Response.json({ data: politicians }));
  const user = userEvent.setup(); render(<AdminPoliticiansPage />);
  await user.click(await screen.findByRole("button", { name: "Reconcile Jane Smyth" }));
  await user.selectOptions(screen.getByLabelText("Surviving profile"), politicians[1].id);
  await user.click(screen.getByRole("button", { name: "Confirm reconciliation" }));
  const call = mocks.fetch.mock.calls.find(([, init]) => init?.method === "POST");
  expect(JSON.parse(String(call?.[1]?.body))).toEqual({ targetPoliticianId: politicians[1].id });
  expect(await screen.findByRole("status")).toHaveTextContent("reconciled into Jane Smith");
});