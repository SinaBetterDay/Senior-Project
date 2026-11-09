CREATE TABLE "sync_job_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "heartbeat_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),
    "error" TEXT,

    CONSTRAINT "sync_job_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sync_job_runs_key_status_heartbeat_idx"
    ON "sync_job_runs"("job_key", "status", "heartbeat_at");

CREATE UNIQUE INDEX "sync_job_runs_one_running_per_key"
    ON "sync_job_runs"("job_key")
    WHERE "status" = 'running';

ALTER TABLE "sync_logs"
    ADD COLUMN "job_run_id" UUID;

ALTER TABLE "sync_logs"
    ADD COLUMN "heartbeat_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "sync_logs_job_run_id_idx" ON "sync_logs"("job_run_id");

ALTER TABLE "sync_logs"
    ADD CONSTRAINT "sync_logs_job_run_id_fkey"
    FOREIGN KEY ("job_run_id") REFERENCES "sync_job_runs"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sync_job_runs" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "sync_job_runs" FROM PUBLIC;

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON TABLE "sync_job_runs" FROM anon;
    END IF;

    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON TABLE "sync_job_runs" FROM authenticated;
    END IF;
END $$;
