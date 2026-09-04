/**
 * Verifies form700-uploads bucket: upload + download with secret / service_role key.
 * Also checks that the public URL for a private bucket does not return the file.
 *
 * Prerequisites: run the SQL migration (or create the bucket in the dashboard),
 * and set a project URL + a secret key (new sb_secret_... or legacy service_role JWT) in server/.env
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) {
  console.error('Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL in server/.env');
  process.exit(1);
}
if (!secretKey) {
  console.error(
    'Missing SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY). The publishable key is not enough for private Storage from the server.',
  );
  console.error('Use the default secret key (sb_secret_...) from Supabase → API Keys → Secret keys, or the legacy service_role JWT.');
  process.exit(1);
}

const bucket = 'form700-uploads';
const objectPath = `audit-test/${Date.now()}-smoke-test.xlsx`;

// Minimal bytes; Storage does not validate XLSX structure for this check.
const body = Buffer.from('Smoke test file for form700-uploads bucket.');

const supabase = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { error: upErr } = await supabase.storage.from(bucket).upload(objectPath, body, {
  contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  upsert: false,
});

if (upErr) {
  console.error('Upload failed:', upErr.message);
  process.exit(1);
}

const { data: file, error: dlErr } = await supabase.storage.from(bucket).download(objectPath);

if (dlErr) {
  console.error('Download failed:', dlErr.message);
  process.exit(1);
}

const downloaded = Buffer.from(await file.arrayBuffer());
if (!downloaded.equals(body)) {
  console.error('Downloaded bytes do not match uploaded bytes');
  process.exit(1);
}

const {
  data: { publicUrl },
} = supabase.storage.from(bucket).getPublicUrl(objectPath);

const res = await fetch(publicUrl);
if (res.ok) {
  console.error(
    'Unexpected: public URL returned success for a private bucket. Check bucket is not public.',
  );
  process.exit(1);
}

console.log('OK: upload + download via secret key; public URL not served (HTTP', res.status + ')');
console.log('   Object:', objectPath);
