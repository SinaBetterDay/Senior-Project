// Public API stub — full implementation is Sprint 6.
// Mounted at /api/search in server/src/app.js.
import express from 'express';
import prisma from '../lib/prisma.js';

const router = express.Router();

const RESULT_LIMIT = 8;

router.get('/', async (req, res, next) => {
  const query = String(req.query.q ?? '').trim();

  if (!query) {
    return res.status(200).json({
      query: '',
      groups: {
        politicians: [],
        agendaItems: [],
        conflicts: [],
      },
      total: 0,
    });
  }

  const textFilter = {
    contains: query,
    mode: 'insensitive',
  };

  try {
    const [politicians, agendaItems, conflicts] = await Promise.all([
      prisma.politician.findMany({
        where: {
          OR: [
            { fullName: textFilter },
            { officeTitle: textFilter },
            { party: textFilter },
            { slug: textFilter },
          ],
        },
        select: {
          id: true,
          slug: true,
          fullName: true,
          officeTitle: true,
          party: true,
        },
        orderBy: {
          fullName: 'asc',
        },
        take: RESULT_LIMIT,
      }),

      prisma.agendaItem.findMany({
        where: {
          OR: [
            { title: textFilter },
            { description: textFilter },
            { itemText: textFilter },
            { cityName: textFilter },
          ],
        },
        select: {
          id: true,
          title: true,
          description: true,
          cityName: true,
          meetingDate: true,
        },
        orderBy: {
          meetingDate: 'desc',
        },
        take: RESULT_LIMIT,
      }),

      prisma.conflict.findMany({
        where: {
          OR: [
            { conflictType: textFilter },
            { entityName: textFilter },
            {
              politician: {
                fullName: textFilter,
              },
            },
            {
              agendaItem: {
                OR: [
                  { title: textFilter },
                  { description: textFilter },
                ],
              },
            },
          ],
        },
        select: {
          id: true,
          conflictType: true,
          severity: true,
          entityName: true,
          detectedAt: true,
          politician: {
            select: {
              slug: true,
              fullName: true,
            },
          },
          agendaItem: {
            select: {
              id: true,
              title: true,
              description: true,
            },
          },
        },
        orderBy: {
          detectedAt: 'desc',
        },
        take: RESULT_LIMIT,
      }),
    ]);

    const groups = {
      politicians: politicians.map((politician) => ({
        type: 'politician',
        id: politician.id,
        title: politician.fullName,
        preview: [politician.officeTitle, politician.party]
          .filter(Boolean)
          .join(' · '),
        href: `/politicians/${politician.slug}`,
      })),

      agendaItems: agendaItems.map((item) => ({
        type: 'agendaItem',
        id: item.id,
        title: item.title || 'Untitled agenda item',
        preview: [item.cityName, item.description]
          .filter(Boolean)
          .join(' · ')
          .slice(0, 180),
        href: `/agenda/${item.id}`,
      })),

      conflicts: conflicts.map((conflict) => ({
        type: 'conflict',
        id: conflict.id,
        title: conflict.conflictType,
        preview: [
          conflict.politician?.fullName,
          conflict.entityName,
          conflict.agendaItem?.title,
          `Severity: ${conflict.severity}`,
        ]
          .filter(Boolean)
          .join(' · ')
          .slice(0, 180),
        href: `/conflicts/${conflict.id}`,
      })),
    };

    return res.status(200).json({
      query,
      groups,
      total:
        groups.politicians.length +
        groups.agendaItems.length +
        groups.conflicts.length,
    });
  } catch (error) {
    return next(error);
  }
});

export default router;