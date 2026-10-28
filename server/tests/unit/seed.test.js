import { describe, expect, it, vi } from 'vitest';

import { seedDatabase } from '../../prisma/seed.js';

function createPrismaSeedMock() {
  const log = vi.fn();
  const jurisdictions = new Map();
  const politicians = new Map();
  const jurisdictionUpsert = vi.fn(async ({ where, create }) => {
    if (!jurisdictions.has(where.legistarClientId)) {
      jurisdictions.set(where.legistarClientId, { id: 'jurisdiction-1', ...create });
    }
    return jurisdictions.get(where.legistarClientId);
  });
  const politicianUpsert = vi.fn(async ({ where, create, update }) => {
    const existing = politicians.get(where.slug);
    if (existing) {
      Object.assign(existing, update);
      return existing;
    }
    const record = { id: `politician-${politicians.size + 1}`, ...create };
    politicians.set(where.slug, record);
    return record;
  });

  return {
    prisma: {
      jurisdiction: { upsert: jurisdictionUpsert },
      politician: { upsert: politicianUpsert },
    },
    log,
    jurisdictions,
    politicians,
    jurisdictionUpsert,
    politicianUpsert,
  };
}

describe('Prisma seed process', () => {
  it('creates the documented sample records and remains duplicate-free when rerun', async () => {
    const {
      prisma,
      log,
      jurisdictions,
      politicians,
      jurisdictionUpsert,
      politicianUpsert,
    } = createPrismaSeedMock();

    await seedDatabase(prisma, log);
    await seedDatabase(prisma, log);

    expect(jurisdictions.size).toBe(1);
    expect(jurisdictions.get('ca-state')).toMatchObject({
      name: 'State of California',
      type: 'STATE',
    });
    expect(politicians.size).toBe(6);
    expect([...politicians.keys()].sort()).toEqual([
      'buffy-wicks',
      'eleni-kounalakis',
      'gavin-newsom',
      'rob-bonta',
      'scott-wiener',
      'shannon-grove',
    ]);
    expect(jurisdictionUpsert).toHaveBeenCalledTimes(2);
    expect(politicianUpsert).toHaveBeenCalledTimes(12);
    expect(log).toHaveBeenCalledTimes(2);
  });
});
