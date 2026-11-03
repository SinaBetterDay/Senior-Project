import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("adminAuth", () => {
  beforeEach(() => {
    window.localStorage.clear(); window.sessionStorage.clear();
    vi.resetModules();
    vi.stubEnv("VITE_SUPABASE_URL", "https://fair-test.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "public-anon-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("stores the complete Supabase session used by the admin guard", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      access_token: "access-token",
      refresh_token: "refresh-token",
      expires_in: 3600,
      user: { id: "admin-1", email: "admin@example.gov" },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const { signInWithPassword, getAdminSession } = await import("./adminAuth");
    await signInWithPassword("admin@example.gov", "password");

    const stored = JSON.parse(window.localStorage.getItem("fair.admin.session") ?? "{}");
    expect(stored.access_token).toBe("access-token");
    expect(stored.refresh_token).toBe("refresh-token");
    await expect(getAdminSession()).resolves.toMatchObject({ access_token: "access-token" });
  });

  it("reports placeholder configuration as unavailable", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://YOUR_PROJECT_REF.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "YOUR_PUBLIC_SUPABASE_ANON_OR_PUBLISHABLE_KEY");
    vi.resetModules();
    const { isAdminAuthConfigured } = await import("./adminAuth");
    expect(isAdminAuthConfigured()).toBe(false);
  });

  it('coordinates concurrent refreshes so only one refresh token request runs', async () => {
    window.localStorage.setItem('fair.admin.session', JSON.stringify({ access_token: 'old', refresh_token: 'refresh', expires_in: 1, expires_at: Date.now() - 1 }));
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ access_token: 'new', refresh_token: 'next', expires_in: 3600 }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const { getAdminSession } = await import('./adminAuth');
    const [first, second] = await Promise.all([getAdminSession(), getAdminSession()]);
    expect(first.access_token).toBe('new'); expect(second.access_token).toBe('new');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refreshes and retries one unauthorized API response without clearing the session', async () => {
    window.localStorage.setItem('fair.admin.session', JSON.stringify({ access_token: 'old', refresh_token: 'refresh', expires_in: 3600, expires_at: Date.now() + 3600_000 }));
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({ code: 'authentication_required' }, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ access_token: 'new', refresh_token: 'next', expires_in: 3600 }))
      .mockResolvedValueOnce(Response.json({ data: [] }));
    const { adminFetch } = await import('./adminAuth');
    expect((await adminFetch('/api/admin/history')).status).toBe(200);
    expect(JSON.parse(window.localStorage.getItem('fair.admin.session')!).access_token).toBe('new');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not clear a valid session when verification is temporarily unavailable', async () => {
    window.localStorage.setItem('fair.admin.session', JSON.stringify({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600, expires_at: Date.now() + 3600_000 }));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ error: 'retry', code: 'auth_unavailable' }, { status: 503 }));
    const { verifyAdminAccess } = await import('./adminAuth');
    await expect(verifyAdminAccess()).rejects.toThrow('retry');
    expect(window.localStorage.getItem('fair.admin.session')).not.toBeNull();
  });

  it('retains the session if the refresh after a 401 has a temporary failure', async () => {
    window.localStorage.setItem('fair.admin.session', JSON.stringify({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600, expires_at: Date.now() + 3600_000 }));
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({}, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ msg: 'Authentication service unavailable' }, { status: 503 }));
    const { adminFetch } = await import('./adminAuth');
    await expect(adminFetch('/api/admin/history')).rejects.toThrow('Authentication service unavailable');
    expect(window.localStorage.getItem('fair.admin.session')).not.toBeNull();
  });
  it('keeps an admin session when an owner-only endpoint is forbidden', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    window.localStorage.setItem('fair.admin.session', JSON.stringify({ access_token: 'access', refresh_token: 'refresh', expires_at: Date.now() + 3600_000 }));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ code: 'owner_required' }, { status: 403 }));
    const { adminFetch } = await import('./adminAuth');
    expect((await adminFetch('/api/admin/users')).status).toBe(403);
    expect(window.localStorage.getItem('fair.admin.session')).not.toBeNull();
    expect(assign).toHaveBeenCalledWith('/admin/login?reason=forbidden');
  });
  it('redirects a missing session to login before making an API request', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const { adminFetch, InvalidAdminSession } = await import('./adminAuth');
    await expect(adminFetch('/api/admin/history')).rejects.toBeInstanceOf(InvalidAdminSession);
    expect(assign).toHaveBeenCalledWith('/admin/login?reason=expired');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('clears denied membership and redirects to login', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    window.localStorage.setItem('fair.admin.session', JSON.stringify({ access_token: 'access', refresh_token: 'refresh', expires_at: Date.now() + 3600_000 }));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ code: 'admin_forbidden' }, { status: 403 }));
    const { adminFetch } = await import('./adminAuth');
    expect((await adminFetch('/api/admin/history')).status).toBe(403);
    expect(assign).toHaveBeenCalledWith('/admin/login?reason=forbidden');
    expect(window.localStorage.getItem('fair.admin.session')).toBeNull();
  });
  it('sends missing admin resources to the 404 page without signing out', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { pathname: '/admin/history', search: '', assign });
    window.localStorage.setItem('fair.admin.session', JSON.stringify({ access_token: 'access', refresh_token: 'refresh', expires_at: Date.now() + 3600_000 }));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({}, { status: 404 }));
    const { adminFetch } = await import('./adminAuth');
    expect((await adminFetch('/api/admin/history/missing')).status).toBe(404);
    expect(assign).toHaveBeenCalledWith('/404');
    expect(window.localStorage.getItem('fair.admin.session')).not.toBeNull();
  });
  it('scrubs invitation credentials from the URL after receiving a valid account link', async () => {
    window.history.replaceState(null, '', '/admin/account?invitation=opaque#access_token=access&refresh_token=refresh&expires_in=3600&type=invite');
    const { receiveAccountLink, getAdminSession } = await import('./adminAuth');
    expect(await receiveAccountLink()).toBe('opaque');
    expect(window.location.search).toBe(''); expect(window.location.hash).toBe('');
    expect((await getAdminSession()).access_token).toBe('access');
  });
  it('rejects expired account links and scrubs their URL', async () => {
    window.history.replaceState(null, '', '/admin/account#error_description=expired');
    const { receiveAccountLink } = await import('./adminAuth');
    await expect(receiveAccountLink()).rejects.toThrow('invalid or expired');
    expect(window.location.hash).toBe('');
  });
  it('does not reuse an ordinary logged-in session to authorize password recovery', async () => {
    window.history.replaceState(null, '', '/admin/account');
    window.localStorage.setItem('fair.admin.session', JSON.stringify({ access_token: 'access', refresh_token: 'refresh', expires_at: Date.now() + 3600_000 }));
    const { receiveAccountLink } = await import('./adminAuth');
    await expect(receiveAccountLink()).rejects.toThrow('fresh invitation');
  });
  it('saves the password, accepts the matching invitation, then verifies membership', async () => {
    window.localStorage.setItem('fair.admin.session', JSON.stringify({ access_token: 'access', refresh_token: 'refresh', expires_at: Date.now() + 3600_000 }));
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({ id: 'user' })).mockResolvedValueOnce(Response.json({ data: { role: 'admin' } })).mockResolvedValueOnce(Response.json({ data: { role: 'admin' } }));
    const { finishAccountSetup } = await import('./adminAuth');
    await finishAccountSetup('a-long-password', 'opaque');
    expect(fetchMock.mock.calls[0][0]).toContain('/auth/v1/user');
    expect(fetchMock.mock.calls[1][0]).toContain('/api/admin/users/accept');
    expect(fetchMock.mock.calls[2][0]).toContain('/api/admin/session');
  });
});