CREATE TABLE "politician_review_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "politician_id" UUID NOT NULL,
  "source_politician_id" UUID,
  "action" TEXT NOT NULL,
  "admin_user_id" TEXT NOT NULL,
  "details" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "politician_review_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "politician_review_events_action_check"
    CHECK ("action" IN ('approved', 'merged'))
);

CREATE UNIQUE INDEX "politician_review_events_source_politician_id_key"
  ON "politician_review_events"("source_politician_id");

CREATE INDEX "politician_review_events_politician_created_idx"
  ON "politician_review_events"("politician_id", "created_at" DESC);