import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  actorCall: vi.fn(),
  actor: vi.fn(),
  dataset: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock('apify-client', () => ({
  ApifyClient: vi.fn(function MockApifyClient() {
    return { actor: mocks.actor, dataset: mocks.dataset };
  }),
}));
vi.mock('../../src/lib/prisma.js', () => ({
  prisma: { dataSource: { findMany: mocks.findMany } },
}));

import { scrapeAgendaPDFs } from '../../services/apifyscraper.js';

describe('scrapeAgendaPDFs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.actor.mockReturnValue({ call: mocks.actorCall });
    mocks.actorCall.mockResolvedValue({ defaultDatasetId: 'dataset-1' });
    mocks.dataset.mockReturnValue({ listItems: vi.fn().mockResolvedValue({ items: [] }) });
  });

  it('uses the shared required Actor input for scheduled source runs', async () => {
    mocks.findMany.mockResolvedValue([{
      cityName: 'City of Calexico',
      startUrl: 'https://www.calexico.ca.gov/councilagendas',
      apifyActorId: 'actor-id',
    }]);

    await scrapeAgendaPDFs({ lookbackDays: 14 });

    expect(mocks.actor).toHaveBeenCalledWith('actor-id');
    expect(mocks.actorCall).toHaveBeenCalledWith({
      cityName: 'City of Calexico',
      startUrl: 'https://www.calexico.ca.gov/councilagendas',
      maxDepth: 2,
      maxPages: 200,
      sameDomainOnly: true,
      lookbackDays: 14,
    });
  });

  it('rejects missing source URLs before invoking the Actor', async () => {
    mocks.findMany.mockResolvedValue([{
      cityName: 'City of Calexico', startUrl: null, apifyActorId: 'actor-id',
    }]);

    await expect(scrapeAgendaPDFs()).rejects.toThrow('Agenda archive URL is required for City of Calexico');
    expect(mocks.actorCall).not.toHaveBeenCalled();
  });
});