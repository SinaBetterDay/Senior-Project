import { afterEach, describe, expect, it, vi } from "vitest";
import { request, safeMessage, TIMEOUT_MESSAGE } from "./request";

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
describe("request", () => {
  it("preserves response status and JSON", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ error: "Duplicate filing" }, { status: 409 }));
    const response = await request("/upload");
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Duplicate filing" });
    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.get("X-Request-ID")).toMatch(/^fair-/);
  });
  it("uses the caller's deadline even if fetch never settles", async () => {
    vi.useFakeTimers();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise(() => {}));
    const result = request("/records", { timeoutMs: 1_000 });
    const assertion = expect(result).rejects.toThrow(TIMEOUT_MESSAGE);
    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;
    expect(error).toHaveBeenCalledWith(expect.stringMatching(/^\[request:fair-.*\] timeout$/), expect.objectContaining({
      stage: "waiting-for-headers",
      timeoutMs: 1_000,
    }));
  });
  it("preserves cancellation instead of reporting a timeout", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise(() => {}));
    const controller = new AbortController();
    const result = request("/records", { signal: controller.signal });
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
  });
  it("normalizes network errors without exposing internals", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("internal transport implementation"));
    await expect(request("/records")).rejects.toThrow("Check your connection");
  });
});
describe("safeMessage", () => {
  it("preserves validation errors and strips stacks and HTML", () => {
    expect(safeMessage("File too large. Maximum 10 MB.")).toContain("10 MB");
    expect(safeMessage("Error: broken\n at fn (/private/file.js:1)", "Safe fallback")).toBe("Safe fallback");
    expect(safeMessage("<html>Gateway error</html>", "Safe fallback")).toBe("Safe fallback");
    expect(safeMessage({ stack: "secret" }, "Safe fallback")).toBe("Safe fallback");
  });
});