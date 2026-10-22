export const REQUEST_TIMEOUT_MS = 20_000;
export const UPLOAD_TIMEOUT_MS = 60_000;
export const TIMEOUT_MESSAGE = "The server took too long to respond. Check your connection and try again.";

export type RequestOptions = RequestInit & { timeoutMs?: number };

/** Keep actionable messages, but never display serialized exceptions or HTML. */
export function safeMessage(value: unknown, fallback = "The request could not be completed. Please try again."): string {
  const message = value instanceof Error ? value.message : value;
  if (typeof message !== "string" || !message.trim()) return fallback;
  if (/<[^>]+>|\bat\s+\S+\s*\(|node_modules|PrismaClient|\bSELECT\b|\bINSERT INTO\b/i.test(message)) return fallback;
  return message.split(/\r?\n/)[0].slice(0, 500);
}

/** Deadline includes reading the response body; caller cancellation stays silent. */
export async function request(input: RequestInfo | URL, init: RequestOptions = {}): Promise<Response> {
  const { timeoutMs = REQUEST_TIMEOUT_MS, ...fetchInit } = init;
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (fetchInit.signal?.aborted) throw new DOMException("Cancelled", "AbortError");
  fetchInit.signal?.addEventListener("abort", abort, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const cancellation = new Promise<never>((_, reject) => {
    controller.signal.addEventListener("abort", () => reject(timedOut
      ? new Error(TIMEOUT_MESSAGE)
      : new DOMException("Cancelled", "AbortError")), { once: true });
    timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  });
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(input, { ...fetchInit, signal: controller.signal });
        // Consume a clone within the deadline, leaving the response API intact.
        await response.clone().arrayBuffer();
        return response;
      })(),
      cancellation,
    ]);
  } catch (error) {
    if (timedOut) throw new Error(TIMEOUT_MESSAGE);
    if (controller.signal.aborted) throw new DOMException("Cancelled", "AbortError");
    throw new Error("We couldn’t connect to the server. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
    fetchInit.signal?.removeEventListener("abort", abort);
  }
}