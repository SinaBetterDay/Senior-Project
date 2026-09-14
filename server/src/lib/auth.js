/**
 * Admin auth guard for Express.
 *
 * Verifies the Supabase session JWT sent by the client as
 * `Authorization: Bearer <jwt>` using the service-role client
 * (`supabase.auth.getUser(token)`), attaches the user to `req.user`, and
 * otherwise responds `401 { error: "unauthorized" }`.
 *
 * FAIR has a single admin account and no public registration, so any valid
 * Supabase Auth user is treated as the admin.
 *
 * This middleware never throws: every failure path (missing header, malformed
 * header, invalid/expired token, network error, missing env) ends in a 401.
 */
import { supabase } from './supabase.js';

const UNAUTHORIZED = { error: 'unauthorized' };

export function extractBearerToken(headerValue) {
  if (typeof headerValue !== 'string') return null;
  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  return token.length > 0 ? token : null;
}

export async function requireAdmin(req, res, next) {
  try {
    const token = extractBearerToken(req.headers?.authorization);
    if (!token) {
      return res.status(401).json(UNAUTHORIZED);
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json(UNAUTHORIZED);
    }

    req.user = data.user;
    return next();
  } catch (err) {
    console.error('[auth] requireAdmin failed:', err?.message ?? err);
    return res.status(401).json(UNAUTHORIZED);
  }
}

export default requireAdmin;
