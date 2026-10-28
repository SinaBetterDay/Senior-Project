import { usePublicData } from "../hooks/usePublicData";
import RequestError from "../components/RequestError";
import { Link, useParams } from "react-router";
import { ArrowLeft, FileText, Flag, MapPin } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
type Filing = { id: string; filingYear: number; filedAt?: string | null; filerName?: string | null };
type Conflict = { id: string; conflictType: string; severity: string; entityName: string | null; ruleReference: string; detectedAt: string; agendaItemId: string; agendaItem: { id: string; title: string | null; meetingDate: string | null } };
type Politician = { id: string; name?: string; fullName?: string; officeTitle?: string | null; district: string | null; city?: string | null; filings: Filing[]; conflicts?: Conflict[] };
const title = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
const severityClass = (severity: string) => severity === "HIGH" ? "bg-red-50 text-red-800" : severity === "MEDIUM" ? "bg-amber-50 text-amber-800" : "bg-blue-50 text-blue-800";

export function meta() { return [{ title: "Public official | FAIR" }]; }
export default function PoliticianDetail() {
  const { id } = useParams();
  const { data, loading, error, retry } = usePublicData<Politician>(`${API_URL}/api/politicians/${/^[0-9a-f]{8}-/i.test(id ?? "") ? `id/${id}` : encodeURIComponent(id ?? "")}`);
  const politician = data;
  if (loading) return <main className="page-shell"><div className="surface p-8 text-slate-600" role="status">Loading public official…</div></main>;
  if (error || !politician) return <main className="page-shell"><RequestError message={error || "Record not found."} onRetry={retry} /></main>;
  const name = politician.fullName ?? politician.name ?? "Public official"; const conflicts = politician.conflicts ?? [];
  return <main className="page-shell"><Link to="/politicians" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700"><ArrowLeft size={16} /> Public officials</Link><header className="mt-7 border-b border-slate-200 pb-8"><p className="eyebrow">Public official</p><h1 className="mt-3 text-4xl font-bold tracking-tight">{name}</h1>{politician.officeTitle && <p className="mt-3 text-lg text-slate-700">{politician.officeTitle}</p>}<div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-600">{politician.city && <span className="inline-flex items-center gap-2"><MapPin size={16} />{politician.city}</span>}<span>{politician.district ?? "District not listed"}</span></div></header>
    <div className="mt-8 grid gap-8 lg:grid-cols-[0.75fr_1.25fr]"><section><div className="flex items-center gap-3"><FileText className="text-blue-700" size={21} /><h2 className="text-xl font-bold">Form 700 filings</h2></div><div className="mt-4 space-y-3">{politician.filings.length === 0 ? <div className="surface p-5 text-sm text-slate-600">No filings are available for this official.</div> : politician.filings.map((filing) => <article key={filing.id} className="surface p-5"><p className="data-label">Filing year</p><p className="mt-1 text-xl font-semibold">{filing.filingYear}</p>{filing.filedAt && <p className="mt-2 text-sm text-slate-600">Filed {new Date(filing.filedAt).toLocaleDateString()}</p>}</article>)}</div></section>
      <section><div className="flex items-center gap-3"><Flag className="text-blue-700" size={21} /><h2 className="text-xl font-bold">Linked conflict flags</h2></div><p className="mt-2 text-sm text-slate-600">Flags are automated review signals, not legal findings.</p><div className="mt-4 space-y-3">{conflicts.length === 0 ? <div className="surface p-5 text-sm text-slate-600">No conflict flags are linked to this official.</div> : conflicts.map((conflict) => <Link key={conflict.id} to={`/conflicts/${conflict.id}`} className="surface group block p-5 transition hover:border-blue-300"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold group-hover:text-blue-800">{title(conflict.conflictType)}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${severityClass(conflict.severity)}`}>{conflict.severity}</span></div><p className="mt-2 text-sm text-slate-600">{conflict.agendaItem.title ?? "Agenda item"}</p>{conflict.entityName && <p className="mt-2 text-sm"><span className="text-slate-500">Matched entity:</span> {conflict.entityName}</p>}</Link>)}</div></section>
    </div>
  </main>;
}