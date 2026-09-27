ALTER TABLE "conflicts"
  ADD COLUMN "review_status" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN "review_note" TEXT,
  ADD COLUMN "reviewed_at" TIMESTAMPTZ(3);

ALTER TABLE "conflicts"
  ADD CONSTRAINT "conflicts_review_status_check"
  CHECK ("review_status" IN ('pending', 'confirmed_conflict', 'not_applicable'));

CREATE TABLE "conflict_reviews" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "conflict_id" UUID NOT NULL,
  "admin_user_id" TEXT NOT NULL,
  "reviewed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "old_status" TEXT NOT NULL,
  "new_status" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  CONSTRAINT "conflict_reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "conflict_reviews_status_check"
    CHECK ("new_status" IN ('pending', 'confirmed_conflict', 'not_applicable')),
  CONSTRAINT "conflict_reviews_conflict_id_fkey"
    FOREIGN KEY ("conflict_id") REFERENCES "conflicts"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "conflict_reviews_conflict_id_reviewed_at_idx"
  ON "conflict_reviews"("conflict_id", "reviewed_at" DESC);