import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";

type Conflict = {
  id: string;
  politician: { name: string; district: string | null };
  conflictType: string;
  severity: string;
  ruleReference: string;
  entityName: string | null;
  scheduleEntry: { scheduleType: string; entityName: string | null; dollarValue: string | null; natureOfInterest: string | null } | null;
  agendaItem: { title: string | null; text: string | null; meetingDate: string | null; city: string | null };
};

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
const display = (value: string | null | undefined) => value || "Not available";
const label = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

function severityExplanation(conflict: Conflict) {
  const amount = conflict.scheduleEntry?.dollarValue;
  if (conflict.conflictType === "BUSINESS_POSITION") return "A reported business position was matched to this agenda item. Review the filing and agenda before drawing a conclusion.";
  if (!amount) return "The reported financial interest was matched to this agenda item. Its value could not be confirmed from the filing.";
  if (conflict.severity === "HIGH") return `The reported value (${amount}) falls in the project's high severity band (starting at $10,000).`;
  if (conflict.severity === "MEDIUM") return `The reported value (${amount}) was assigned medium severity by the project's rules. Review the Form 700 entry to confirm the amount.`;
  return `The reported value (${amount}) falls in the project's low severity band. Review the underlying Form 700 entry.`;
}

function date(value: string | null) {
  if (!value) return "Not available";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Not available" : parsed.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

export function meta() { return [{ title: "Conflict detail | FAIR" }]; }

export default function ConflictDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const back = `/conflicts${params.size ? `?${params.toString()}` : ""}`;
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [status, setStatus] = useState<"loading" | "missing" | "error" | "ready">("loading");

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    fetch(`${API_URL}/api/conflicts/${encodeURIComponent(id ?? "")}`, { signal: controller.signal })
      .then(async response => {
        if (response.status === 404) { setStatus("missing"); return; }
        if (!response.ok) throw new Error("Unable to load conflict");
        const body = await response.json();
        setConflict(body.data);
        setStatus("ready");
      })
      .catch(error => { if (error.name !== "AbortError") setStatus("error"); });
    return () => controller.abort();
  }, [id]);

  return <main className="min-h-screen bg-slate-50 text-slate-900">
    <div className="mx-auto max-w-4xl px-5 py-10">
      <Link to={back} className="text-sm font-semibold text-blue-700 hover:underline">← Back to conflicts</Link>
      {status === "loading" && <p className="mt-12" role="status">Loading conflict…</p>}
      {status === "missing" && <section className="mt-12"><h1 className="text-3xl font-bold">404 — Conflict not found</h1><p className="mt-3">This conflict ID does not exist or is no longer available.</p></section>}
      {status === "error" && <section className="mt-12"><h1 className="text-3xl font-bold">Unable to load conflict</h1><p className="mt-3">Please try again later.</p></section>}
      {status === "ready" && conflict && <>
        <header className="mt-9 border-b border-slate-200 pb-7">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Conflict detail</p>
          <h1 className="mt-2 text-3xl font-bold">{conflict.politician.name}</h1>
          <p className="mt-2 text-slate-600">District: {display(conflict.politician.district)}</p>
          <div className="mt-5 flex flex-wrap items-center gap-3"><span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-900">{label(conflict.conflictType)}</span><span className={`rounded-full px-3 py-1 text-sm font-bold ${conflict.severity === "HIGH" ? "bg-red-100 text-red-900" : conflict.severity === "MEDIUM" ? "bg-amber-100 text-amber-900" : "bg-green-100 text-green-900"}`}>{conflict.severity}</span></div>
        </header>
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6"><h2 className="text-xl font-bold">Why this was flagged</h2><p className="mt-3 leading-relaxed">{severityExplanation(conflict)}</p><p className="mt-3 text-sm text-slate-600">A flag calls for review; it does not establish a legal conflict.</p><p className="mt-4 text-sm"><strong>Rule reference:</strong> {display(conflict.ruleReference)}</p></section>
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6"><h2 className="text-xl font-bold">Form 700 disclosure</h2><dl className="mt-4 grid gap-4 sm:grid-cols-2"><div><dt className="text-sm text-slate-500">Schedule</dt><dd className="font-medium">{conflict.scheduleEntry ? `Schedule ${conflict.scheduleEntry.scheduleType}` : "Not available"}</dd></div><div><dt className="text-sm text-slate-500">Entity or property</dt><dd className="font-medium">{display(conflict.scheduleEntry?.entityName ?? conflict.entityName)}</dd></div><div><dt className="text-sm text-slate-500">Reported value</dt><dd className="font-medium">{display(conflict.scheduleEntry?.dollarValue)}</dd></div><div><dt className="text-sm text-slate-500">Nature of interest</dt><dd className="font-medium">{display(conflict.scheduleEntry?.natureOfInterest)}</dd></div></dl></section>
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6"><h2 className="text-xl font-bold">Agenda item</h2><p className="mt-3 text-sm text-slate-600">Meeting: {date(conflict.agendaItem.meetingDate)} · City: {display(conflict.agendaItem.city)}</p>{conflict.agendaItem.title && <h3 className="mt-5 font-semibold">{conflict.agendaItem.title}</h3>}<p className="mt-3 whitespace-pre-wrap leading-relaxed">{display(conflict.agendaItem.text)}</p></section>
      </>}
    </div>
  </main>;
}
