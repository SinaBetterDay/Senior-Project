const SLOW_REQUEST_MS = Number(process.env.SLOW_REQUEST_MS ?? 2_000);

export function requestTiming(req, res, next) {
  const startedAt = performance.now();
  res.on('finish', () => {
    const durationMs = Math.round(performance.now() - startedAt);
    if (durationMs >= SLOW_REQUEST_MS || res.statusCode >= 500) {
      console.warn(`[http] ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`);
    }
  });
  next();
}