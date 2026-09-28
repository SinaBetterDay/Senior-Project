import { useEffect, useState, type ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router";
import { LogOut } from "lucide-react";
import { getAdminSession, signOut } from "./adminAuth";

export function AdminGuard({ children }: { children: ReactNode }) {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const location = useLocation();

  useEffect(() => {
    let active = true;
    getAdminSession()
      .then(() => active && setAuthorized(true))
      .catch(() => active && setAuthorized(false));
    return () => {
      active = false;
    };
  }, []);

  if (authorized === null) return <div className="p-8 text-sm text-slate-600">Checking admin session...</div>;
  if (!authorized) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

export function AdminNav({ title }: { title: string }) {
  async function handleSignOut() {
    await signOut();
    window.location.assign("/admin/login");
  }

  return (
    <header className="border-b border-slate-300 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div>
          <Link to="/admin/upload" className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-800">FAIR / Admin</Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-950">{title}</h1>
        </div>
        <nav className="flex items-center gap-2 text-sm">
          <Link className="rounded px-3 py-2 text-slate-700 hover:bg-slate-100" to="/admin/upload">Upload</Link>
          <Link className="rounded px-3 py-2 text-slate-700 hover:bg-slate-100" to="/admin/politicians">Politicians</Link>
          <Link className="rounded px-3 py-2 text-slate-700 hover:bg-slate-100" to="/admin/sources">Sources</Link>
          <button className="ml-2 inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-slate-700 hover:bg-slate-50" onClick={handleSignOut} type="button">
            <LogOut size={16} aria-hidden="true" /> Sign out
          </button>
        </nav>
      </div>
    </header>
  );
}