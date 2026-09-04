-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "jurisdictions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "legistar_client_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jurisdictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "politicians" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "office_title" TEXT NOT NULL,
    "party" TEXT,
    "district" TEXT,
    "photo_url" TEXT,
    "external_id" TEXT,
    "jurisdiction_id" UUID,
    "needs_review" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "politicians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meetings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "jurisdiction_id" UUID NOT NULL,
    "body_name" TEXT NOT NULL,
    "meeting_date" TIMESTAMP(3) NOT NULL,
    "agenda_url" TEXT,
    "legistar_event_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agenda_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "meeting_id" UUID,
    "title" TEXT,
    "description" TEXT,
    "item_number" TEXT,
    "source_type" TEXT NOT NULL DEFAULT 'legistar',
    "item_text" TEXT,
    "city_id" TEXT,
    "city_name" TEXT,
    "body_name" TEXT,
    "meeting_date" TIMESTAMP(3),
    "legistar_item_id" TEXT,
    "legistar_event_id" TEXT,
    "legistar_matter_id" TEXT,
    "agenda_number" TEXT,
    "event_item_passed_flag" BOOLEAN,
    "legistar_item_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agenda_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vote_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agenda_item_id" UUID NOT NULL,
    "politician_id" UUID NOT NULL,
    "vote" TEXT NOT NULL,
    "vote_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vote_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form700_filings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "politician_id" UUID NOT NULL,
    "filing_year" INTEGER NOT NULL,
    "filer_name" TEXT,
    "original_filename" TEXT,
    "archived_path" TEXT,
    "storage_path" TEXT,
    "filed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form700_filings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conflict_flags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "politician_id" UUID NOT NULL,
    "agenda_item_id" UUID,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conflict_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_a_investments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "filing_id" UUID NOT NULL,
    "politician_id" UUID,
    "entity_name" TEXT NOT NULL,
    "fair_market_value" TEXT,
    "nature_of_investment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_a_investments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_b_realestate" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "filing_id" UUID NOT NULL,
    "politician_id" UUID,
    "property_description" TEXT,
    "city" TEXT,
    "county" TEXT,
    "fair_market_value" TEXT,
    "nature_of_interest" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_b_realestate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_cde_income" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "filing_id" UUID NOT NULL,
    "politician_id" UUID,
    "schedule_type" TEXT NOT NULL,
    "source_name" TEXT,
    "amount" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_cde_income_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_a2_business_positions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "filing_id" UUID NOT NULL,
    "politician_id" UUID,
    "entity_name" TEXT NOT NULL,
    "business_position" TEXT,
    "fair_market_value" TEXT,
    "nature_of_investment" TEXT,
    "gross_income_range" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_a2_business_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_sources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "city_name" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "legistar_base_url" TEXT,
    "legistar_client_id" TEXT,
    "apify_actor_id" TEXT,
    "start_url" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_synced_at" TIMESTAMP(3),
    "last_error" TEXT,
    "jurisdiction_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "data_source_id" UUID,
    "source_type" TEXT,
    "status" TEXT NOT NULL DEFAULT 'running',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "items_found" INTEGER NOT NULL DEFAULT 0,
    "items_inserted" INTEGER NOT NULL DEFAULT 0,
    "items_skipped" INTEGER NOT NULL DEFAULT 0,
    "conflicts_detected" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "jurisdictions_legistar_client_id_key" ON "jurisdictions"("legistar_client_id");

-- CreateIndex
CREATE UNIQUE INDEX "politicians_slug_key" ON "politicians"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "agenda_items_legistar_item_id_key" ON "agenda_items"("legistar_item_id");

-- CreateIndex
CREATE INDEX "agenda_items_meeting_date_idx" ON "agenda_items"("meeting_date");

-- CreateIndex
CREATE INDEX "agenda_items_city_name_meeting_date_idx" ON "agenda_items"("city_name", "meeting_date");

-- CreateIndex
CREATE UNIQUE INDEX "vote_records_agenda_item_id_politician_id_key" ON "vote_records"("agenda_item_id", "politician_id");

-- CreateIndex
CREATE UNIQUE INDEX "form700_filings_politician_id_filing_year_key" ON "form700_filings"("politician_id", "filing_year");

-- CreateIndex
CREATE INDEX "schedule_a_investments_filing_id_idx" ON "schedule_a_investments"("filing_id");

-- CreateIndex
CREATE INDEX "schedule_a_investments_politician_id_idx" ON "schedule_a_investments"("politician_id");

-- CreateIndex
CREATE INDEX "schedule_b_realestate_filing_id_idx" ON "schedule_b_realestate"("filing_id");

-- CreateIndex
CREATE INDEX "schedule_b_realestate_politician_id_idx" ON "schedule_b_realestate"("politician_id");

-- CreateIndex
CREATE INDEX "schedule_cde_income_filing_id_idx" ON "schedule_cde_income"("filing_id");

-- CreateIndex
CREATE INDEX "schedule_cde_income_politician_id_idx" ON "schedule_cde_income"("politician_id");

-- CreateIndex
CREATE INDEX "schedule_cde_income_schedule_type_idx" ON "schedule_cde_income"("schedule_type");

-- CreateIndex
CREATE INDEX "schedule_a2_business_positions_filing_id_idx" ON "schedule_a2_business_positions"("filing_id");

-- CreateIndex
CREATE INDEX "schedule_a2_business_positions_politician_id_idx" ON "schedule_a2_business_positions"("politician_id");

-- CreateIndex
CREATE INDEX "data_sources_source_type_enabled_idx" ON "data_sources"("source_type", "enabled");

-- CreateIndex
CREATE INDEX "sync_logs_data_source_id_started_at_idx" ON "sync_logs"("data_source_id", "started_at");

-- CreateIndex
CREATE INDEX "sync_logs_started_at_idx" ON "sync_logs"("started_at");

-- AddForeignKey
ALTER TABLE "politicians" ADD CONSTRAINT "politicians_jurisdiction_id_fkey" FOREIGN KEY ("jurisdiction_id") REFERENCES "jurisdictions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_jurisdiction_id_fkey" FOREIGN KEY ("jurisdiction_id") REFERENCES "jurisdictions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_items" ADD CONSTRAINT "agenda_items_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vote_records" ADD CONSTRAINT "vote_records_agenda_item_id_fkey" FOREIGN KEY ("agenda_item_id") REFERENCES "agenda_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vote_records" ADD CONSTRAINT "vote_records_politician_id_fkey" FOREIGN KEY ("politician_id") REFERENCES "politicians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form700_filings" ADD CONSTRAINT "form700_filings_politician_id_fkey" FOREIGN KEY ("politician_id") REFERENCES "politicians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conflict_flags" ADD CONSTRAINT "conflict_flags_politician_id_fkey" FOREIGN KEY ("politician_id") REFERENCES "politicians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conflict_flags" ADD CONSTRAINT "conflict_flags_agenda_item_id_fkey" FOREIGN KEY ("agenda_item_id") REFERENCES "agenda_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_a_investments" ADD CONSTRAINT "schedule_a_investments_filing_id_fkey" FOREIGN KEY ("filing_id") REFERENCES "form700_filings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_a_investments" ADD CONSTRAINT "schedule_a_investments_politician_id_fkey" FOREIGN KEY ("politician_id") REFERENCES "politicians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_b_realestate" ADD CONSTRAINT "schedule_b_realestate_filing_id_fkey" FOREIGN KEY ("filing_id") REFERENCES "form700_filings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_b_realestate" ADD CONSTRAINT "schedule_b_realestate_politician_id_fkey" FOREIGN KEY ("politician_id") REFERENCES "politicians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_cde_income" ADD CONSTRAINT "schedule_cde_income_filing_id_fkey" FOREIGN KEY ("filing_id") REFERENCES "form700_filings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_cde_income" ADD CONSTRAINT "schedule_cde_income_politician_id_fkey" FOREIGN KEY ("politician_id") REFERENCES "politicians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_a2_business_positions" ADD CONSTRAINT "schedule_a2_business_positions_filing_id_fkey" FOREIGN KEY ("filing_id") REFERENCES "form700_filings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_a2_business_positions" ADD CONSTRAINT "schedule_a2_business_positions_politician_id_fkey" FOREIGN KEY ("politician_id") REFERENCES "politicians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_sources" ADD CONSTRAINT "data_sources_jurisdiction_id_fkey" FOREIGN KEY ("jurisdiction_id") REFERENCES "jurisdictions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_data_source_id_fkey" FOREIGN KEY ("data_source_id") REFERENCES "data_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

