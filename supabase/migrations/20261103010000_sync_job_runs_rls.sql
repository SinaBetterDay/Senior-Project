ALTER TABLE public."sync_job_runs" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."sync_job_runs" FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE public."sync_job_runs" FROM anon;
  END IF;

  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE public."sync_job_runs" FROM authenticated;
  END IF;
END $$;
