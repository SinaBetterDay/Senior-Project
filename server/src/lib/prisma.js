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

export const prisma =
  globalForPrisma.__fairPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__fairPrisma = prisma;
}

export default prisma;
