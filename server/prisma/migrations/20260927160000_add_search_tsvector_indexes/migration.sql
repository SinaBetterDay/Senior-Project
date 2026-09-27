-- Add PostgreSQL full-text search indexes for global search.

CREATE INDEX "politicians_search_tsvector_idx"
ON "politicians"
USING GIN (
  to_tsvector(
    'english',
    concat_ws(
      ' ',
      "full_name",
      "office_title",
      "party",
      "district",
      "slug"
    )
  )
);

CREATE INDEX "agenda_items_search_tsvector_idx"
ON "agenda_items"
USING GIN (
  to_tsvector(
    'english',
    concat_ws(
      ' ',
      "title",
      "description",
      "item_text",
      "city_name",
      "body_name"
    )
  )
);

CREATE INDEX "conflicts_search_tsvector_idx"
ON "conflicts"
USING GIN (
  to_tsvector(
    'english',
    concat_ws(
      ' ',
      "conflict_type",
      "severity",
      "rule_reference",
      "entity_name",
      "source_key"
    )
  )
);