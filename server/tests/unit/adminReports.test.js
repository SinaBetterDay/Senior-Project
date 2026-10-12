import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  launch: vi.fn(),
  conflictFindMany: vi.fn(),
  politicianFindUnique: vi.fn(),
  setContent: vi.fn(),
  pdf: vi.fn(),
  close: vi.fn(),
}));

vi.mock('puppeteer', () => ({ default: { launch: mocks.launch } }));
vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    conflict: { findMany: mocks.conflictFindMany },
    politician: { findUnique: mocks.politicianFindUnique },
  },
}));

import reportsRouter from '../../src/routes/admin/reports.js';

const app = express();
app.use(express.json());
app.use('/api/admin/reports', reportsRouter);
app.use((error, _req, res, _next) => res.status(500).json({ error: error.message }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.politicianFindUnique.mockResolvedValue({ fullName: 'Alex Rivera' });
  mocks.conflictFindMany.mockResolvedValue([{
    conflictType: 'INVESTMENT',
    severity: 'HIGH',
    entityName: 'Acme Holdings',
    detectedAt: new Date('2026-10-03T12:00:00.000Z'),
    reviewStatus: 'pending',
    ruleReference: 'Gov. Code 87103',
    politician: { fullName: 'Alex Rivera', jurisdiction: { name: 'Oakland' } },
    agendaItem: { title: 'Contract review', cityName: 'Oakland', meetingDate: new Date('2026-10-02T00:00:00.000Z') },
  }]);
  mocks.setContent.mockResolvedValue(undefined);
  mocks.pdf.mockResolvedValue(Buffer.from('%PDF-test'));
  mocks.close.mockResolvedValue(undefined);
  mocks.launch.mockResolvedValue({
    newPage: async () => ({ setContent: mocks.setContent, pdf: mocks.pdf }),
    close: mocks.close,
  });
});

describe('admin PDF reports', () => {
  it('renders the scoped report template with Puppeteer and returns PDF bytes', async () => {
    const response = await request(app)
      .post('/api/admin/reports/pdf')
      .send({ scope: 'city', city: 'Oakland' });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/pdf');
    expect(response.headers['content-disposition']).toMatch(/^attachment; filename="fair-conflict-report-\d{4}-\d{2}-\d{2}\.pdf"$/);
    expect(response.body.toString()).toBe('%PDF-test');
    expect(mocks.conflictFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { OR: [
        { agendaItem: { is: { cityName: 'Oakland' } } },
        { politician: { is: { jurisdiction: { is: { name: 'Oakland' } } } } },
      ] },
    }));
    expect(mocks.launch).toHaveBeenCalledWith(expect.objectContaining({ headless: true }));
    expect(mocks.setContent.mock.calls[0][0]).toContain('Contract review');
    expect(mocks.pdf).toHaveBeenCalledWith(expect.objectContaining({
      format: 'Letter',
      landscape: true,
      printBackground: true,
      preferCSSPageSize: true,
    }));
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it('rejects invalid date ranges without querying conflicts or launching Chromium', async () => {
    const response = await request(app)
      .post('/api/admin/reports/pdf')
      .send({ scope: 'dateRange', startDate: '2026-02-30', endDate: '2026-03-01' });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/Invalid start date/);
    expect(mocks.conflictFindMany).not.toHaveBeenCalled();
    expect(mocks.launch).not.toHaveBeenCalled();
  });
});