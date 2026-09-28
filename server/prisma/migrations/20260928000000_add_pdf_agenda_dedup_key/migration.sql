-- Remove existing duplicate PDF/Apify rows before enforcing retry-safe ingestion.
DELETE FROM "agenda_items" a
USING "agenda_items" b
WHERE a."id" > b."id"
  AND a."city_id" = b."city_id"
  AND a."meeting_date" = b."meeting_date"
  AND a."item_number" = b."item_number";

CREATE UNIQUE INDEX "agenda_items_city_id_meeting_date_item_number_key"
ON "agenda_items"("city_id", "meeting_date", "item_number");