type SupabaseUser = {
  id: string;
};

export type AdminSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  user: SupabaseUser;
};

const sessionKey = "fair.admin.session";
export const apiBaseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

function getAuthConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Supabase Auth is not configured for the client.");
  return { url: url.replace(/\/$/, ""), anonKey };
}

async function authRequest<T>(path: string, body?: Record<string, string>, accessToken?: string): Promise<T> {
  const { url, anonKey } = getAuthConfig();
  const response = await fetch(`${url}/auth/v1/${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.msg ?? result.message ?? "Supabase Auth request failed.");
  }
  return result as T;
}

function storeSession(session: AdminSession): AdminSession {
  const normalized = {
    ...session,
    expires_at: session.expires_at ?? Math.floor(Date.now() / 1000) + session.expires_in,
  };
  sessionStorage.setItem(sessionKey, JSON.stringify(normalized));
  return normalized;
}

function readSession(): AdminSession | null {
  try {
    const value = sessionStorage.getItem(sessionKey);
    if (!value) return null;
    const session = JSON.parse(value) as AdminSession;
    return session.access_token && session.refresh_token && session.user?.id ? session : null;
  } catch {
    return null;
  }
}

export async function signInAdmin(email: string, password: string): Promise<AdminSession> {
  const session = await authRequest<AdminSession>("token?grant_type=password", { email, password });
  if (!session.user?.id) throw new Error("Unable to establish an authenticated session.");
  return storeSession(session);
}

export async function getVerifiedAdminSession(): Promise<AdminSession | null> {
  let session = readSession();
  if (!session) return null;

  if ((session.expires_at ?? 0) <= Math.floor(Date.now() / 1000) + 30) {
    try {
      session = storeSession(await authRequest<AdminSession>("token?grant_type=refresh_token", {
        refresh_token: session.refresh_token,
      }));
    } catch {
      sessionStorage.removeItem(sessionKey);
      return null;
    }
  }

  const user = await authRequest<SupabaseUser>("user", undefined, session.access_token);
  if (!user.id) {
    sessionStorage.removeItem(sessionKey);
    return null;
  }
  session.user = user;
  return storeSession(session);
}