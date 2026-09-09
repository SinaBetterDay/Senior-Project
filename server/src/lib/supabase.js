/**
 * Single server-side Supabase client (service role).
 *
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (legacy service_role JWT), or
 * SUPABASE_SECRET_KEY (new `sb_secret_...` key) as a fallback — same convention
 * as `server/scripts/test-form700-storage.mjs`.
 *
 * The client is created lazily on first use so that importing this module (e.g.
 * from `lib/auth.js` during app boot, or from unit tests that mock it) never
 * throws when env vars are missing. Misconfiguration surfaces as a clear error
 * at the first call site instead.
 *
 * NEVER expose this client or its key to the browser — it bypasses RLS.
 */
import { createClient } from '@supabase/supabase-js';

let client = null;

export function getSupabase() {
  if (client) return client;

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!url) {
    throw new Error('[supabase] Missing SUPABASE_URL in server/.env');
  }
  if (!key) {
    throw new Error(
      '[supabase] Missing SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) in server/.env',
    );
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/**
 * Ergonomic alias: `supabase.auth.getUser(...)`, `supabase.storage.from(...)`,
 * `supabase.from('politicians')...` all work and resolve the real client on
 * first property access.
 */
export const supabase = new Proxy(
  {},
  {
    get(_target, prop) {
      const real = getSupabase();
      const value = real[prop];
      return typeof value === 'function' ? value.bind(real) : value;
    },
  },
);

export default supabase;
