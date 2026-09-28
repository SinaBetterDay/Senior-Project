-- Add PostgreSQL full-text search indexes for global search.
-- Use immutable concatenation so PostgreSQL can create the indexes.

CREATE INDEX "politicians_search_tsvector_idx"
ON "politicians"
USING GIN (
  to_tsvector(
    'english',
    coalesce("full_name", '')
      || ' ' || coalesce("office_title", '')
      || ' ' || coalesce("party", '')
      || ' ' || coalesce("district", '')
      || ' ' || coalesce("slug", '')
  )
);

CREATE INDEX "agenda_items_search_tsvector_idx"
ON "agenda_items"
USING GIN (
  to_tsvector(
    'english',
    coalesce("title", '')
      || ' ' || coalesce("description", '')
      || ' ' || coalesce("item_text", '')
      || ' ' || coalesce("city_name", '')
      || ' ' || coalesce("body_name", '')
  )
);

CREATE INDEX "conflicts_search_tsvector_idx"
ON "conflicts"
USING GIN (
  to_tsvector(
    'english',
    coalesce("conflict_type", '')
      || ' ' || coalesce("severity", '')
      || ' ' || coalesce("rule_reference", '')
      || ' ' || coalesce("entity_name", '')
      || ' ' || coalesce("source_key", '')
  )
);