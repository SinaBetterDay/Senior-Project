export function handleDeadLetter(job: any) {
    console.error("🚨 DEAD LETTER JOB:");
    console.error("Job Name:", job.name);
    console.error("Job ID:", job.id);
    console.error("Payload:", job.data);
    console.error("Failed Reason:", job.failedReason);
}