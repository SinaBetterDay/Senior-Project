/**
 * Admin auth guard for Express.
 *
 * Verifies the Supabase session JWT sent by the client as
 * `Authorization: Bearer <jwt>` using the service-role client
 * (`supabase.auth.getUser(token)`), attaches the user to `req.user`, and
 * otherwise responds `401 { error: "unauthorized" }`.
 *
 * FAIR authorizes the single admin account by comparing the verified user's
 * email with the server-only FAIR_ADMIN_EMAIL setting. Missing configuration
 * fails closed with the same 401 response used for invalid credentials.
 *
 * This middleware never throws: every failure path (missing header, malformed
 * header, invalid/expired token, network error, missing env) ends in a 401.
 */
import { supabase } from './supabase.js';

const UNAUTHORIZED = { error: 'unauthorized' };

export function isAuthorizedAdmin(user) {
  const configuredEmail = String(process.env.FAIR_ADMIN_EMAIL ?? '').trim().toLowerCase();
  const userEmail = String(user?.email ?? '').trim().toLowerCase();
  return Boolean(configuredEmail && userEmail && configuredEmail === userEmail);
}

export function extractBearerToken(headerValue) {
  if (typeof headerValue !== 'string') return null;
  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  return token.length > 0 ? token : null;
}

export async function requireAdmin(req, res, next) {
  const startedAt = performance.now();
  const id = req.requestId ?? 'unknown';
  try {
    const token = extractBearerToken(req.headers?.authorization);
    if (!token) {
      console.warn(`[auth:${id}] missing bearer token ${Math.round(performance.now() - startedAt)}ms`);
      return res.status(401).json(UNAUTHORIZED);
    }

    console.info(`[auth:${id}] verifying Supabase user`);
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      console.warn(`[auth:${id}] rejected ${Math.round(performance.now() - startedAt)}ms`);
      return res.status(401).json(UNAUTHORIZED);
    }

    if (!isAuthorizedAdmin(data.user)) {
      console.warn(`[auth:${id}] valid user is not an authorized admin`);
      return res.status(401).json(UNAUTHORIZED);
    }

    req.user = data.user;
    console.info(`[auth:${id}] verified ${Math.round(performance.now() - startedAt)}ms`);
    return next();
  } catch (err) {
    console.error('[auth] requireAdmin failed:', err?.message ?? err);
    return res.status(401).json(UNAUTHORIZED);
  }
}

export default requireAdmin;
