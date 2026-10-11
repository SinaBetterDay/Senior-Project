/**
 * Shared PrismaClient singleton.
 *
 * This is the ONLY place `new PrismaClient()` should be called on the server.
 * The instance is cached on `globalThis` so `node --watch` reloads (which
 * re-evaluate modules but keep the same process) reuse the existing connection
 * pool instead of leaking one per reload.
 */
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;
const maxConnections = Number(process.env.PRISMA_MAX_CONNECTIONS ?? 20);

export const prisma =
  globalForPrisma.__fairPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
    datasources: {
      db: {
        url: `${process.env.DATABASE_URL}${process.env.DATABASE_URL.includes('?') ? '&' : '?'}connection_limit=${Math.max(1, Math.min(maxConnections, 20))}`,
      },
    },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__fairPrisma = prisma;
}

export default prisma;
