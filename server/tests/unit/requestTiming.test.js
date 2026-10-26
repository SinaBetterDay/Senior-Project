import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { requestTiming } from '../../src/middleware/requestTiming.js';

describe('requestTiming', () => {
  it('echoes a safe client request ID and logs matching lifecycle events', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const app = express();
    app.use(requestTiming);
    app.get('/probe', (_req, res) => res.json({ ok: true }));

    const response = await request(app).get('/probe').set('X-Request-ID', 'fair-browser-123');

    expect(response.headers['x-request-id']).toBe('fair-browser-123');
    expect(info).toHaveBeenCalledWith('[http:fair-browser-123] start GET /probe');
    expect(info).toHaveBeenCalledWith(expect.stringMatching(/^\[http:fair-browser-123\] finish GET \/probe 200 \d+ms$/));
  });

  it('replaces unsafe request IDs', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const app = express();
    app.use(requestTiming);
    app.get('/probe', (_req, res) => res.end());

    const response = await request(app).get('/probe').set('X-Request-ID', 'unsafe request id');

    expect(response.headers['x-request-id']).toMatch(/^server-/);
  });
});