create extension if not exists "uuid-ossp";

CREATE TABLE conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  politician_id uuid NOT NULL
    REFERENCES politicians(id),
  agenda_item_id uuid NOT NULL
    REFERENCES agenda_items(id),
  conflict_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  rule_reference text NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX conflicts_politician_id_idx ON conflicts (politician_id);
CREATE INDEX conflicts_agenda_item_id_idx ON conflicts (agenda_item_id);
CREATE INDEX conflicts_detected_at_idx ON conflicts (detected_at DESC);