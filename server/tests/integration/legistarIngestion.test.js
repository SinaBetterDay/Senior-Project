import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { runLegistarSyncForCity } from "../../src/jobs/nightlySync.js";

const liveDatabaseUrl = process.env.LIVE_LEGISTAR_DATABASE_URL;
const runLiveIntegration =
  process.env.RUN_LIVE_LEGISTAR_INTEGRATION === "true" && Boolean(liveDatabaseUrl);
const describeLive = runLiveIntegration ? describe : describe.skip;
const prisma = runLiveIntegration
  ? new PrismaClient({ datasources: { db: { url: liveDatabaseUrl } } })
  : null;

const TEST_CITY = {
    name: "City of Sacramento",
    baseUrl: "https://webapi.legistar.com/v1/sacramento",
    clientId: "sacramento"
};

let insertedAgendaItemIds = [];

describeLive("Legistar ingestion integration", () => {
    afterAll(async () => {
        if (!prisma) return;
        try {
            if (insertedAgendaItemIds.length > 0) {
                await prisma.conflict.deleteMany({
                    where: { agendaItemId: { in: insertedAgendaItemIds } },
                });
                await prisma.agendaItem.deleteMany({
                    where: { id: { in: insertedAgendaItemIds } },
                });
            }
        } finally {
            await prisma.$disconnect();
        }
    });

    it("ingests real legistar data and avoids duplicates on second run", async () => {
        const originalDatabaseUrl = process.env.DATABASE_URL;
        const originalDirectUrl = process.env.DIRECT_URL;
        process.env.DATABASE_URL = liveDatabaseUrl;
        process.env.DIRECT_URL = liveDatabaseUrl;

        try {
        const firstRun = await runLegistarSyncForCity({
            baseUrl: TEST_CITY.baseUrl,
            cityName: TEST_CITY.name,
        });

        expect(firstRun.meetingFetched).toBeGreaterThan(0);
        expect(firstRun.itemsFound).toBeGreaterThan(0);
        expect(firstRun.insertedAgendaItemIds).toBeInstanceOf(Array);
        insertedAgendaItemIds = firstRun.insertedAgendaItemIds;

        if (insertedAgendaItemIds.length > 0) {
            const stored = await prisma.agendaItem.count({
                where: { id: { in: insertedAgendaItemIds } },
            });
            expect(stored).toBe(insertedAgendaItemIds.length);
        }

        const secondRun = await runLegistarSyncForCity ({
            baseUrl: TEST_CITY.baseUrl,
            cityName: TEST_CITY.name,
        });

        expect(secondRun.itemsSkipped).toBeGreaterThanOrEqual(0);
        expect(secondRun.itemsInserted).toBe(0);
        } finally {
            process.env.DATABASE_URL = originalDatabaseUrl;
            process.env.DIRECT_URL = originalDirectUrl;
        }
    });
});
