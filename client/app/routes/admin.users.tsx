import { useEffect, useState, type FormEvent } from 'react';
import { AdminGuard, AdminNav } from '../adminComponents';
import { adminFetch, verifyAdminAccess } from '../adminAuth';
import { Navigate } from 'react-router';

type Role = 'owner' | 'admin';
type Member = { userId: string; email: string; role: Role; active: boolean };
type Invitation = { id: string; email: string; role: Role; status: string; expiresAt: string; lastError: string | null };
type Audit = { id: string; actorId: string; action: string; target: string; createdAt: string };
type Access = { members: Member[]; invitations: Invitation[]; audit: Audit[] };

export function meta() { return [{ title: 'Manage users | FAIR Admin' }]; }
export default function UsersPage() {
  return <AdminGuard><Users /></AdminGuard>;
}
function Users() {
  const [role, setRole] = useState<Role | null>(null);
  const [data, setData] = useState<Access | null>(null);
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('admin');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function load() {
    const identity = await verifyAdminAccess(); setRole(identity.role);
    if (identity.role !== 'owner') return;
    const response = await adminFetch('/api/admin/users');
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? 'Could not load users.');
    setData(payload.data);
  }
  useEffect(() => { void load().catch(reason => setError(reason.message)); }, []);
  async function mutate(path: string, method: string, body?: object) {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await adminFetch(`/api/admin/users${path}`, { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'User management action failed.');
      setMessage('Changes saved.'); setEmail('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Action failed.'); }
    finally { try { await load(); } catch { setError(previous => previous || 'Refresh failed. Retry before making more changes.'); } setBusy(false); }
  }
  function invite(event: FormEvent) { event.preventDefault(); void mutate('/invitations', 'POST', { email, role: inviteRole }); }
  if (role === 'admin') return <Navigate to="/admin/login?reason=forbidden" replace />;
  return <div className="min-h-screen bg-slate-50"><AdminNav title="Users" /><main className="page-shell space-y-6"><h2 className="text-2xl font-bold">Manage admin access</h2>
    {error && <div role="alert"><p className="text-red-700">{error}</p><button className="button-secondary" onClick={() => { setError(''); void load().catch(reason => setError(reason.message)); }}>Retry</button></div>}
    {message && <p role="status">{message}</p>}
    {role === null && !error && <p role="status">Loading users…</p>}
    {role === 'owner' && data && <><section className="surface p-5"><h3 className="text-lg font-semibold">Invite a user</h3><p className="my-2 text-sm">Owners manage users. Admins can use uploads, reviews, reports, and sources. Invitations expire after 48 hours; email links may expire sooner.</p><form onSubmit={invite} className="flex flex-wrap items-end gap-3"><label>Email<input className="field" type="email" required value={email} onChange={event => setEmail(event.target.value)} /></label><label>Role<select className="field" value={inviteRole} onChange={event => setInviteRole(event.target.value as Role)}><option value="admin">Admin</option><option value="owner">Owner</option></select></label><button className="button-primary" disabled={busy}>Send invitation</button></form></section>
    <section className="surface space-y-3 p-5"><h3 className="text-lg font-semibold">Users</h3>{data.members.map(member => <div key={member.userId} className="flex flex-wrap items-center gap-3 border-t pt-3"><span className="flex-1">{member.email} — {member.active ? 'Active' : 'Disabled'}</span><label>Role for {member.email}<select className="field" disabled={busy} value={member.role} onChange={event => { if (window.confirm(`Change ${member.email}'s role?`)) void mutate(`/${member.userId}`, 'PATCH', { role: event.target.value }); }}><option value="admin">Admin</option><option value="owner">Owner</option></select></label><button className="button-secondary" disabled={busy} onClick={() => { if (window.confirm(`${member.active ? 'Disable' : 'Enable'} access for ${member.email}?`)) void mutate(`/${member.userId}`, 'PATCH', { active: !member.active }); }}>{member.active ? 'Disable' : 'Enable'}</button></div>)}</section>
    <section className="surface space-y-3 p-5"><h3 className="text-lg font-semibold">Recent invitations</h3>{data.invitations.length === 0 && <p>No invitations yet.</p>}{data.invitations.map(invitation => <div key={invitation.id} className="border-t pt-3"><p>{invitation.email} — {invitation.role} — {invitation.status}{invitation.status === 'pending' && new Date(invitation.expiresAt) < new Date() ? ' (expired)' : ''}</p>{invitation.lastError && <p className="text-red-700">{invitation.lastError}</p>}{['pending', 'sending', 'delivery_failed'].includes(invitation.status) && <div className="mt-2 flex gap-2"><button className="button-secondary" disabled={busy} onClick={() => void mutate(`/invitations/${invitation.id}/resend`, 'POST')}>Resend to {invitation.email}</button><button className="button-secondary" disabled={busy} onClick={() => { if (window.confirm(`Revoke invitation for ${invitation.email}?`)) void mutate(`/invitations/${invitation.id}`, 'DELETE'); }}>Revoke</button></div>}</div>)}</section>
    <section className="surface space-y-2 p-5"><h3 className="text-lg font-semibold">Recent access history</h3>{data.audit.map(entry => <p className="break-words text-sm" key={entry.id}>{new Date(entry.createdAt).toLocaleString()} · {entry.action.replaceAll('_', ' ')} · {data.members.find(member => member.userId === entry.actorId)?.email ?? entry.actorId} · {entry.target}</p>)}</section></>}
  </main></div>;
}