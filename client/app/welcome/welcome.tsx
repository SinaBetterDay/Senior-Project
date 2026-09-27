import { useEffect, useState } from "react";
import { Link } from "react-router";
import { apiBaseUrl } from "../lib/supabase";

type Conflict = {
  id: string;
  conflictType: string;
  severity: string;
  reviewStatus: "pending" | "confirmed_conflict" | "not_applicable";
  politician: { fullName: string; officeTitle: string };
  agendaItem: { title: string | null; itemText: string | null };
};

const statusLabel = {
  pending: "Pending",
  confirmed_conflict: "Confirmed conflict",
  not_applicable: "Not applicable",
};

export function Welcome() {
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl}/api/conflicts`)
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load conflicts");
        return response.json();
      })
      .then(setConflicts)
      .catch(() => setError("Conflict data is temporarily unavailable."));
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-12 text-slate-900 md:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-700">FAIR</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">Conflict dashboard</h1>
            <p className="mt-2 max-w-2xl text-slate-600">Conflict flags from public meeting and disclosure data.</p>
          </div>
          <Link className="text-sm font-semibold text-indigo-700 hover:text-indigo-900" to="/admin/login">Admin</Link>
        </header>

        {error && <p className="rounded-lg bg-rose-100 p-4 text-rose-800">{error}</p>}
        {!error && conflicts.length === 0 && <p className="rounded-lg bg-white p-8 text-slate-600 shadow-sm">No conflict flags found.</p>}
        <div className="grid gap-4 md:grid-cols-2">
          {conflicts.map((conflict) => (
            <Link
              key={conflict.id}
              to={`/conflicts/${conflict.id}`}
              className={`rounded-xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${conflict.reviewStatus === "not_applicable" ? "border-slate-300 bg-slate-200" : "border-white bg-white"}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-bold">{conflict.politician.fullName}</h2>
                  <p className="text-sm text-slate-600">{conflict.politician.officeTitle}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{statusLabel[conflict.reviewStatus]}</span>
              </div>
              <p className="mt-5 text-sm font-semibold">{conflict.conflictType}</p>
              <p className="mt-1 text-sm text-slate-600">{conflict.agendaItem.title ?? conflict.agendaItem.itemText ?? "Agenda details unavailable"}</p>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">{conflict.severity} severity</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}