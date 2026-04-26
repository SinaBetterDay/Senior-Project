import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { runLegistarSyncForCity } from "../../src/jobs/nightlySync.js";

const prisma = new PrismaClient();

const TEST_CITY = {
    name: "City of Sacramento",
    baseUrl: "https://webapi.legistar.com/v1/sacramento",
    clientId: "sacramento"
};

let jurisdictionId;
let insertedMeetingIds = [];

describe("Legistar ingestion integration", () => {
    beforeAll(async () => {
        const jurisdiction = await prisma.jurisdiction.upsert({
            where: { legistarClientId: TEST_CITY.clientId},
            update: {
                name: TEST_CITY.name,
                type: "CITY",
            },
            create: {
                name: TEST_CITY.name,
                type: "CITY",
                legistarClientId: TEST_CITY.clientId
            }
        });
        jurisdictionId = jurisdiction.id;
    });

    afterAll(async () => {
        if (insertedMeetingIds.length > 0) {
            await prisma.agendaItem.deleteMany( {
                where: {
                    meetingId: { in: insertedMeetingIds }
           }       

            });
            await prisma.meeting.deleteMany({
                where: {
                    id: { in: insertedMeetingIds }
                }
            });
        }
        await prisma.$disconnect();
    });

    it("ingests real legistar data and avoids duplicates on second run", async () => {
        const firstRun = await runLegistarSyncForCity({
            jurisdictionId,
            baseUrl: TEST_CITY.baseUrl,
        });

        expect(firstRun.meetingFetched).toBeGreaterThan(0);
        expect(firstRun.itemsFound).toBeGreaterThan(0);

        const meetings = await prisma.meeting.findMany({
            where: { jurisdictionId },
            include: { agendaItems: true }

        });
        
        const totalItemsAfterFirstRun = meetings.reduce(
            (sum, meeting) => sum + meeting.agendaItems.length,
            0
        );

        expect(totalItemsAfterFirstRun).toBeGreaterThan(0);

        insertedMeetingIds = meetings.map((m) => m.id);

        const secondRun = await runLegistarSyncForCity ({
            jurisdictionId,
            baseUrl: TEST_CITY.baseUrl
        });

        const meetingsAfterSecondRun = await prisma.meeting.findMany({
            where: {jurisdictionId},
            include: { agendaItems: true}
        });

        const totalItemsAfterSecondRun = meetingsAfterSecondRun.reduce(
            (sum, meeting) => sum + meeting.agendaItems.length,
            0
        );

        expect(totalItemsAfterFirstRun).toBe(totalItemsAfterFirstRun);
        expect(secondRun.itemsSkipped).toBeGreaterThanOrEqual(0);
    });

            
 });
