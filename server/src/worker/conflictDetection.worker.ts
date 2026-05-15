import { Worker } from "bullmq";
import { redis } from "../queue/redis";
import { handleDeadLetter } from "../queue/dlq";

export const conflictDetectionWorker = new Worker(
    "conflict-detection",
    async (job) => {
        try {
            // 🔥 YOUR CONFLICT ENGINE LOGIC HERE
            console.log("Running conflict detection:", job.data);

            const agendas = job.data.agendas;

            // simulate processing
            return {
                conflictsFound: false,
                count: agendas?.length ?? 0,
            };
        } catch (err) {
            throw err;
        }
    },
    {
        connection: redis,
    }
);

conflictDetectionWorker.on("failed", async (job) => {
    if (!job) return;
    if (job.attemptsMade >= 3) {
        handleDeadLetter(job);
    }
});