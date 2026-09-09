-- CreateTable
CREATE TABLE "conflicts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "politician_id" UUID NOT NULL,
    "agenda_item_id" UUID NOT NULL,
    "conflict_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "rule_reference" TEXT NOT NULL,
    "entity_name" TEXT,
    "source_key" TEXT NOT NULL,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conflicts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conflicts_identity_key" ON "conflicts"("politician_id", "agenda_item_id", "conflict_type", "source_key");

-- CreateIndex
CREATE INDEX "conflicts_politician_id_idx" ON "conflicts"("politician_id");

-- CreateIndex
CREATE INDEX "conflicts_agenda_item_id_idx" ON "conflicts"("agenda_item_id");

-- CreateIndex
CREATE INDEX "conflicts_detected_at_idx" ON "conflicts"("detected_at");

-- AddForeignKey
ALTER TABLE "conflicts" ADD CONSTRAINT "conflicts_politician_id_fkey" FOREIGN KEY ("politician_id") REFERENCES "politicians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conflicts" ADD CONSTRAINT "conflicts_agenda_item_id_fkey" FOREIGN KEY ("agenda_item_id") REFERENCES "agenda_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
