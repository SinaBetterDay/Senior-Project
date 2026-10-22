ALTER TABLE "agenda_items"
ADD COLUMN "source_url" TEXT;

-- Preserve links stored by the older manual Apify path before item_text began
-- holding parsed agenda text.
UPDATE "agenda_items"
SET "source_url" = "item_text"
WHERE "source_type" = 'apify'
  AND "item_text" ~ '^https?://';