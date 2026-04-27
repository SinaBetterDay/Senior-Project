import { Worker } from "bullmq";
import { redis } from "../queue/redis";
import { conflictDetectionQueue } from "../queue/queues";
import { handleDeadLetter } from "../queue/dlq";

export const agendaIngestionWorker = new Worker(
    "agenda-ingestion",
    async (job) => {
        try {
            // 🔥 YOUR LEGISTAR SYNC LOGIC GOES HERE
            console.log("Running Legistar ingestion:", job.data);

            // Example result
            const agendas = job.data.agendas || [];

            // After ingestion → trigger conflict detection
            await conflictDetectionQueue.add("run-conflict-check", {
                agendas,
            });

            return { success: true };
        } catch (err) {
            throw err;
        }
    },
    {
        connection: redis,
    }
);

// Dead letter handling
agendaIngestionWorker.on("failed", async (job, err) => {
    if (!job) return;
    if (job.attemptsMade >= 3) {
        handleDeadLetter(job);
    }
});