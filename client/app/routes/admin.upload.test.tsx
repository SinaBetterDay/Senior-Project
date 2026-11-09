import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import Upload from "./admin.upload";
import { UPLOAD_TIMEOUT_MS } from "../lib/request";

vi.mock("../adminComponents", () => ({ AdminGuard: ({ children }: { children: React.ReactNode }) => children, AdminNav: () => null }));
vi.mock("../adminAuth", () => ({ adminFetch: async () => Response.json({ data: [] }), getAdminAccessToken: async () => "token", clearAdminSession: vi.fn() }));
afterEach(() => vi.unstubAllGlobals());

it.each(["validation", "timeout"])("shows a specific %s failure and retry upload", async kind => {
  let xhr: any;
  class MockRequest {
    upload = {}; timeout = 0; status = 409;
    responseText = JSON.stringify({ error: "A filing for 2026 already exists." });
    onload?: () => void; ontimeout?: () => void;
    constructor() { xhr = this; }
    open() {} setRequestHeader() {} send() {}
  }
  vi.stubGlobal("XMLHttpRequest", MockRequest);
  render(<Upload />);
  fireEvent.change(screen.getByLabelText('Individual Form 700 file (XLSX or PDF, maximum 10 MB)'), { target: { files: [new File(["workbook"], "filing.xlsx")] } });
  fireEvent.click(screen.getByRole("button", { name: "Upload Form 700" }));
  await waitFor(() => expect(xhr).toBeDefined());
  expect(xhr.timeout).toBe(UPLOAD_TIMEOUT_MS);
  if (kind === "timeout") xhr.ontimeout(); else xhr.onload();
  expect(await screen.findByRole("alert")).toHaveTextContent(kind === "timeout" ? "took too long" : "A filing for 2026 already exists.");
  expect(screen.getByRole("button", { name: "Retry upload" })).toBeEnabled();
  expect(screen.queryByText("Upload complete")).not.toBeInTheDocument();
});

it.each(['select', 'drop'])('uploads a PDF via %s and displays parser warnings', async method => {
  let xhr: any;
  let body: FormData;
  class MockRequest {
    upload = {}; status = 200;
    responseText = JSON.stringify({ filing_id: 'filing', politician_id: 'official', politician: null, schedules_parsed: { A: 0, B: 0, CDE: 0, A2: 0 }, warnings: ['This PDF contains no financial schedule pages.'] });
    constructor() { xhr = this; }
    open() {} setRequestHeader() {} send(value: FormData) { body = value; }
  }
  vi.stubGlobal('XMLHttpRequest', MockRequest);
  render(<Upload />);
  const file = new File(['%PDF-1.4'], 'filing.PDF', { type: 'application/pdf' });
  const input = screen.getByLabelText('Individual Form 700 file (XLSX or PDF, maximum 10 MB)');
  expect(input.getAttribute('accept')).toContain('.pdf');
  if (method === 'select') fireEvent.change(input, { target: { files: [file] } });
  else fireEvent.drop(screen.getByRole('button', { name: /Drop an XLSX workbook or PDF/ }), { dataTransfer: { files: [file] } });
  fireEvent.click(screen.getByRole('button', { name: 'Upload Form 700' }));
  await waitFor(() => expect(xhr).toBeDefined());
  expect(body!.get('file')).toBe(file);
  xhr.onload();
  expect(await screen.findByText('This PDF contains no financial schedule pages.')).toBeVisible();
});

it.each([['filing.txt', 1], ['filing.pdf', 10 * 1024 * 1024 + 1]])('rejects invalid or oversized %s files', async (name, size) => {
  render(<Upload />);
  const file = new File(['x'], name);
  Object.defineProperty(file, 'size', { value: size });
  fireEvent.change(screen.getByLabelText('Individual Form 700 file (XLSX or PDF, maximum 10 MB)'), { target: { files: [file] } });
  expect(screen.getByRole('alert')).toHaveTextContent(name.endsWith('.txt') ? 'Only .xlsx or .pdf' : '10 MB');
  expect(screen.getByRole('button', { name: 'Upload Form 700' })).toBeDisabled();
});

it('distinguishes bulk and individual uploads in a responsive two-panel layout', async () => {
  render(<Upload />);
  const bulk = screen.getByRole('region', { name: 'Bulk Form 700 import' });
  const individual = screen.getByRole('region', { name: 'Upload individual Form 700' });
  expect(bulk.parentElement).toBe(individual.parentElement);
  expect(bulk.parentElement).toHaveClass('grid-cols-1', 'lg:grid-cols-2');
  expect(within(bulk).getByText('Multiple officials · XLSX only')).toBeVisible();
  expect(within(individual).getByText('One official · XLSX or PDF')).toBeVisible();
  expect(within(bulk).getByRole('button', { name: 'Choose bulk XLSX workbook' })).toBeVisible();
  expect(within(individual).getByText('Choose individual XLSX or PDF')).toBeVisible();
  expect(within(bulk).getByText(/Have a PDF or a single official/)).toBeVisible();
  expect(within(individual).getByText(/Have a county or agency workbook/)).toBeVisible();
  expect(within(bulk).getByLabelText('Bulk workbook (maximum 10 MB)')).toHaveAttribute('accept', '.xlsx');
  expect(within(individual).getByLabelText('Individual Form 700 file (XLSX or PDF, maximum 10 MB)')).toHaveAttribute('accept', expect.stringContaining('.pdf'));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
});