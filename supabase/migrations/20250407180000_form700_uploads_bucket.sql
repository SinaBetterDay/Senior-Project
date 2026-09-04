-- Private bucket for raw Form 700 XLSX audit copies.
-- The service role key bypasses RLS; anon/authenticated have no policies here, so they cannot access objects.
-- Create the bucket as non-public so Storage public URLs do not serve files without a signed URL or service role.

INSERT INTO storage.buckets (id, name, public)
VALUES ('form700-uploads', 'form700-uploads', false)
ON CONFLICT (id) DO UPDATE SET public = false;
