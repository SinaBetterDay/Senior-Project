const SLOW_REQUEST_MS = Number(process.env.SLOW_REQUEST_MS ?? 2_000);
const PENDING_REQUEST_MS = Number(process.env.PENDING_REQUEST_MS ?? 5_000);

function requestId(value) {
  if (typeof value === 'string' && /^[A-Za-z0-9._:-]{1,100}$/.test(value)) return value;
  return `server-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function requestTiming(req, res, next) {
  const startedAt = performance.now();
  const id = requestId(req.get('X-Request-ID'));
  req.requestId = id;
  res.setHeader('X-Request-ID', id);
  console.info(`[http:${id}] start ${req.method} ${req.originalUrl}`);
  const pendingTimer = setTimeout(() => {
    console.warn(`[http:${id}] pending ${req.method} ${req.originalUrl} ${Math.round(performance.now() - startedAt)}ms`);
  }, PENDING_REQUEST_MS);
  let finished = false;
  res.on('finish', () => {
    finished = true;
    clearTimeout(pendingTimer);
    const durationMs = Math.round(performance.now() - startedAt);
    const message = `[http:${id}] finish ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`;
    if (durationMs >= SLOW_REQUEST_MS || res.statusCode >= 500) console.warn(message);
    else console.info(message);
  });
  res.on('close', () => {
    clearTimeout(pendingTimer);
    if (!finished) console.warn(`[http:${id}] closed ${req.method} ${req.originalUrl} ${Math.round(performance.now() - startedAt)}ms`);
  });
  next();
}