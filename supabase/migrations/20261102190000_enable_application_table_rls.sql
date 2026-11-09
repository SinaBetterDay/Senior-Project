-- Browser clients use the Express API, not direct table access through the
-- Supabase Data API. With RLS enabled and no policies, browser roles are denied.
ALTER TABLE public."admin_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."admin_access_state" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."admin_invitations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."admin_access_audit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."jurisdictions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."politicians" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."politician_review_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."meetings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."agenda_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."vote_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."form700_filings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."form700_import_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."conflict_flags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."conflicts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."conflict_reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."detection_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."detection_run_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."schedule_a_investments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."schedule_b_realestate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."schedule_cde_income" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."schedule_a2_business_positions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."data_sources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."sync_logs" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public."admin_members",
  public."admin_access_state",
  public."admin_invitations",
  public."admin_access_audit",
  public."jurisdictions",
  public."politicians",
  public."politician_review_events",
  public."meetings",
  public."agenda_items",
  public."vote_records",
  public."form700_filings",
  public."form700_import_runs",
  public."conflict_flags",
  public."conflicts",
  public."conflict_reviews",
  public."detection_runs",
  public."detection_run_items",
  public."schedule_a_investments",
  public."schedule_b_realestate",
  public."schedule_cde_income",
  public."schedule_a2_business_positions",
  public."data_sources",
  public."sync_logs"
FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE
      public."admin_members",
      public."admin_access_state",
      public."admin_invitations",
      public."admin_access_audit",
      public."jurisdictions",
      public."politicians",
      public."politician_review_events",
      public."meetings",
      public."agenda_items",
      public."vote_records",
      public."form700_filings",
      public."form700_import_runs",
      public."conflict_flags",
      public."conflicts",
      public."conflict_reviews",
      public."detection_runs",
      public."detection_run_items",
      public."schedule_a_investments",
      public."schedule_b_realestate",
      public."schedule_cde_income",
      public."schedule_a2_business_positions",
      public."data_sources",
      public."sync_logs"
    FROM anon;
  END IF;

  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE
      public."admin_members",
      public."admin_access_state",
      public."admin_invitations",
      public."admin_access_audit",
      public."jurisdictions",
      public."politicians",
      public."politician_review_events",
      public."meetings",
      public."agenda_items",
      public."vote_records",
      public."form700_filings",
      public."form700_import_runs",
      public."conflict_flags",
      public."conflicts",
      public."conflict_reviews",
      public."detection_runs",
      public."detection_run_items",
      public."schedule_a_investments",
      public."schedule_b_realestate",
      public."schedule_cde_income",
      public."schedule_a2_business_positions",
      public."data_sources",
      public."sync_logs"
    FROM authenticated;
  END IF;
END $$;
