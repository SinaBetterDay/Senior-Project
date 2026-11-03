import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { finishAccountSetup, receiveAccountLink } from '../adminAuth';

export function meta() { return [{ title: 'Set your password | FAIR' }, { name: 'referrer', content: 'no-referrer' }]; }

export default function AccountPage() {
  const started = useRef(false);
  const [ready, setReady] = useState(false);
  const [invitation, setInvitation] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    receiveAccountLink().then(token => { setInvitation(token); setReady(true); }).catch(reason => setError(reason.message));
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirmation) { setError('Passwords do not match.'); return; }
    setBusy(true); setError('');
    try { await finishAccountSetup(password, invitation); navigate('/admin/sources', { replace: true }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Account setup failed.'); }
    finally { setBusy(false); }
  }
  return <main className="page-shell"><section className="surface mx-auto max-w-lg space-y-5 p-8"><h1 className="text-2xl font-bold">Set your password</h1><p>Choose a password to finish your invitation or reset your existing password.</p>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {!ready && !error && <p role="status">Checking your account link…</p>}
    {ready && <form className="space-y-4" onSubmit={submit}><label className="block">New password<input className="field" type="password" autoComplete="new-password" minLength={12} required value={password} onChange={event => setPassword(event.target.value)} /></label><label className="block">Confirm password<input className="field" type="password" autoComplete="new-password" minLength={12} required value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label><p className="text-sm">Use at least 12 characters.</p><button className="button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save password and continue'}</button></form>}
    <Link to="/admin/login" className="text-blue-800 underline">Return to sign in</Link>
  </section></main>;
}