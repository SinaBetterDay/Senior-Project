import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { signInWithPassword } from "../adminAuth";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signInWithPassword(email.trim(), password);
      navigate("/admin/upload", { replace: true });
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <section className="w-full max-w-md border border-slate-300 bg-white p-8 shadow-sm">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-emerald-800">FAIR / Admin</p>
        <h1 className="mb-6 text-2xl font-semibold text-slate-950">Sign in</h1>

        <form className="space-y-4" onSubmit={handleLogin}>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full border border-slate-300 px-3 py-2 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full border border-slate-300 px-3 py-2 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          {error && <p className="border-l-4 border-red-700 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</p>}

          <button type="submit" disabled={submitting} className="w-full bg-emerald-800 px-4 py-2.5 font-semibold text-white hover:bg-emerald-900 disabled:opacity-60">
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}