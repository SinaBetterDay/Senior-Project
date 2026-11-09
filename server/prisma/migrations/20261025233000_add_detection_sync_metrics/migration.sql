ALTER TABLE "sync_logs"
ADD COLUMN "conflict_candidates" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "conflicts_skipped" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "detection_errors" JSONB;
