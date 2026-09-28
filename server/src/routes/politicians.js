import express from 'express';
import { prisma } from '../lib/prisma.js';

const router = express.Router();

router.get('/:slug', async (req, res, next) => {
  try {
    const politician = await prisma.politician.findUnique({
      where: { slug: req.params.slug },
      select: {
        id: true,
        slug: true,
        fullName: true,
        officeTitle: true,
        district: true,
        jurisdiction: { select: { name: true } },
        filings: {
          orderBy: { filingYear: 'desc' },
          select: { id: true, filingYear: true, filerName: true },
        },
      },
    });
    if (!politician) return res.status(404).json({ error: 'Politician not found.' });

    return res.json({ data: {
      id: politician.id,
      slug: politician.slug,
      name: politician.fullName,
      officeTitle: politician.officeTitle,
      district: politician.district,
      city: politician.jurisdiction?.name ?? null,
      filings: politician.filings,
    } });
  } catch (error) {
    return next(error);
  }
});

router.get('/', async (_req, res, next) => {
  try {
    const politicians = await prisma.politician.findMany({
      orderBy: { fullName: 'asc' },
      select: { id: true, slug: true, fullName: true, district: true },
    });
    return res.json({ data: politicians });
  } catch (error) {
    return next(error);
  }
});

export default router;
