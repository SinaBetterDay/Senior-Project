/**
 * Admin auth guard for Express.
 *
 * Verifies the Supabase session JWT sent by the client as
 * `Authorization: Bearer <jwt>` using the service-role client
 * (`supabase.auth.getUser(token)`), attaches the user to `req.user`, and
 * otherwise returns a structured 401, 403, or 503 response.
 *
 * Active database memberships authorize requests. FAIR_ADMIN_EMAIL only
 * bootstraps the first verified owner, before initialization is complete.
 *
 * Invalid sessions receive 401, unauthorized users receive 403, and temporary
 * verification/configuration failures receive 503 without granting access.
 */
import { supabase } from './supabase.js';
import { membershipFor } from './adminAccess.js';

const AUTHENTICATION_REQUIRED = { error: 'Admin session is invalid or expired.', code: 'authentication_required' };
const FORBIDDEN = { error: 'This Supabase account is not authorized as the FAIR administrator.', code: 'admin_forbidden' };
const AUTH_UNAVAILABLE = { error: 'Admin authentication could not be verified. Please retry.', code: 'auth_unavailable' };

export function extractBearerToken(headerValue) {
  if (typeof headerValue !== 'string') return null;
  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  return token.length > 0 ? token : null;
}

export async function requireAuthenticated(req, res, next) {
  const startedAt = performance.now();
  const id = req.requestId ?? 'unknown';
  try {
    const token = extractBearerToken(req.headers?.authorization);
    if (!token) {
      console.warn(`[auth:${id}] missing bearer token ${Math.round(performance.now() - startedAt)}ms`);
      return res.status(401).json(AUTHENTICATION_REQUIRED);
    }

    console.info(`[auth:${id}] verifying Supabase user`);
    const { data, error } = await supabase.auth.getUser(token);
    if (error && (error.status >= 500 || error.status === 429 || ![400, 401, 403, 422].includes(error.status))) {
      console.warn(`[auth:${id}] Supabase verification temporarily unavailable`);
      return res.status(503).json(AUTH_UNAVAILABLE);
    }
    if (error || !data?.user) {
      console.warn(`[auth:${id}] rejected ${Math.round(performance.now() - startedAt)}ms`);
      return res.status(401).json(AUTHENTICATION_REQUIRED);
    }

    req.user = data.user;
    console.info(`[auth:${id}] verified ${Math.round(performance.now() - startedAt)}ms`);
    return next();
  } catch (err) {
    console.error('[auth] requireAdmin failed:', err?.message ?? err);
    return res.status(503).json(AUTH_UNAVAILABLE);
  }
}

export function requireAdmin(req, res, next) {
  return requireAuthenticated(req, res, async () => {
    try {
      const member = await membershipFor(req.user);
      if (!member) return res.status(403).json(FORBIDDEN);
      req.adminMember = member;
      return next();
    } catch (error) {
      console.error('[auth] membership verification failed:', error?.message);
      return res.status(503).json(AUTH_UNAVAILABLE);
    }
  });
}

export function requireOwner(req, res, next) {
  if (req.adminMember?.active && req.adminMember.role === 'owner') return next();
  return res.status(403).json({ error: 'Only an active owner can manage users.', code: 'owner_required' });
}

export default requireAdmin;
