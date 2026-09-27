import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { apiBaseUrl, getVerifiedAdminSession } from "../lib/supabase";

type ReviewStatus = "pending" | "confirmed_conflict" | "not_applicable";
type Conflict = {
  id: string;
  conflictType: string;
  severity: string;
  ruleReference: string;
  detectedAt: string;
  reviewStatus: ReviewStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  politician: { fullName: string; officeTitle: string };
  agendaItem: {
    title: string | null;
    itemText: string | null;
    bodyName: string | null;
    cityName: string | null;
    meetingDate: string | null;
    meeting: { meetingDate: string; bodyName: string } | null;
  };
};

const statusLabel: Record<ReviewStatus, string> = {
  pending: "Pending",
  confirmed_conflict: "Confirmed conflict",
  not_applicable: "Not applicable",
};

export default function ConflictDetailPage() {
  const { id } = useParams();
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [status, setStatus] = useState<ReviewStatus>("pending");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    getVerifiedAdminSession()
      .then((session) => setIsAdmin(session !== null))
      .catch(() => setIsAdmin(false));
  }, []);

  useEffect(() => {
    fetch(`${apiBaseUrl}/api/conflicts/${id}`)
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load conflict");
        return response.json();
      })
      .then((data: Conflict) => {
        setConflict(data);
        setStatus(data.reviewStatus);
      })
      .catch(() => setMessage("Conflict data is temporarily unavailable."));
  }, [id]);

  async function saveReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (note.trim().length < 10) {
      setMessage("Add a note of at least 10 characters before saving.");
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const session = await getVerifiedAdminSession();
      if (!session) {
        setIsAdmin(false);
        throw new Error("Sign in with the admin account to save this review.");
      }

      const response = await fetch(`${apiBaseUrl}/api/conflicts/${id}/review`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ status, note }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to save review");
      setConflict(data);
      setNote("");
      setMessage("Review saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save review");
    } finally {
      setSaving(false);
    }
  }

  if (!conflict) return <main className="p-10">{message ?? "Loading conflict..."}</main>;

  const agendaTitle = conflict.agendaItem.title ?? conflict.agendaItem.itemText ?? "Agenda details unavailable";
  const meetingName = conflict.agendaItem.meeting?.bodyName ?? conflict.agendaItem.bodyName ?? conflict.agendaItem.cityName;
  const meetingDate = conflict.agendaItem.meeting?.meetingDate ?? conflict.agendaItem.meetingDate;

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-10 text-slate-900 md:px-10">
      <div className="mx-auto max-w-4xl">
        <Link to="/" className="text-sm font-semibold text-indigo-700">&larr; All conflicts</Link>
        <article className={`mt-5 rounded-2xl bg-white p-6 shadow-sm md:p-10 ${conflict.reviewStatus === "not_applicable" ? "border-2 border-slate-300" : ""}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-indigo-700">{conflict.conflictType}</p>
              <h1 className="mt-2 text-3xl font-bold">{conflict.politician.fullName}</h1>
              <p className="mt-1 text-slate-600">{conflict.politician.officeTitle}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold">{statusLabel[conflict.reviewStatus]}</span>
          </div>
          <dl className="mt-8 grid gap-5 border-y border-slate-200 py-6 sm:grid-cols-2">
            <div><dt className="text-xs font-bold uppercase text-slate-500">Agenda item</dt><dd className="mt-1">{agendaTitle}</dd></div>
            <div><dt className="text-xs font-bold uppercase text-slate-500">Meeting</dt><dd className="mt-1">{meetingName ?? "Meeting details unavailable"}{meetingDate ? ` (${new Date(meetingDate).toLocaleDateString()})` : ""}</dd></div>
            <div><dt className="text-xs font-bold uppercase text-slate-500">Rule reference</dt><dd className="mt-1">{conflict.ruleReference}</dd></div>
            <div><dt className="text-xs font-bold uppercase text-slate-500">Severity</dt><dd className="mt-1 capitalize">{conflict.severity.toLowerCase()}</dd></div>
          </dl>
          <section className="mt-8">
            <h2 className="text-lg font-bold">Review record</h2>
            {conflict.reviewNote ? <p className="mt-2 rounded-lg bg-slate-50 p-4 text-slate-700">{conflict.reviewNote}</p> : <p className="mt-2 text-slate-500">No review note has been recorded.</p>}
            {conflict.reviewedAt && <p className="mt-2 text-xs text-slate-500">Reviewed {new Date(conflict.reviewedAt).toLocaleString()}</p>}
          </section>
          {isAdmin && (
            <form onSubmit={saveReview} className="mt-10 border-t border-slate-200 pt-8">
              <h2 className="text-lg font-bold">Admin review</h2>
              <label className="mt-4 block text-sm font-semibold" htmlFor="status">Status</label>
              <select id="status" value={status} onChange={(event) => setStatus(event.target.value as ReviewStatus)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                <option value="pending">Pending</option><option value="confirmed_conflict">Confirmed conflict</option><option value="not_applicable">Not applicable</option>
              </select>
              <label className="mt-4 block text-sm font-semibold" htmlFor="note">Mandatory note</label>
              <textarea id="note" required minLength={10} value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 min-h-28 w-full rounded-lg border border-slate-300 p-3" placeholder="Explain the review decision (10 characters minimum)." />
              <button disabled={saving} className="mt-4 rounded-lg bg-indigo-700 px-5 py-2 font-bold text-white disabled:opacity-50">{saving ? "Saving..." : "Save review"}</button>
              {message && <p role="status" className="mt-3 text-sm font-semibold text-slate-700">{message}</p>}
            </form>
          )}
        </article>
      </div>
    </main>
  );
}
