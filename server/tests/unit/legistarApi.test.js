import { afterEach, describe, expect, it, vi } from 'vitest';
import { getMeetings } from '../../src/ingestion/legistarApi.js';

afterEach(() => vi.unstubAllGlobals());

describe('Legistar API requests', () => {
  it('uses an AbortSignal so stalled upstream requests have a real deadline', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json([]));
    vi.stubGlobal('fetch', fetchMock);

    await getMeetings('https://webapi.legistar.com/v1/example', 1);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/Events?'),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});