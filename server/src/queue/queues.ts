import { Queue } from "bullmq";
import { redis } from "./redis";

const connection = redis;

export const agendaIngestionQueue = new Queue("agenda-ingestion", {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 1000, // 1s base → 1s, 2s, 4s
        },
        removeOnComplete: true,
    },
});

export const conflictDetectionQueue = new Queue("conflict-detection", {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 1000,
        },
        removeOnComplete: true,
    },
});