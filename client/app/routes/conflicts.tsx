import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { AlertCircle, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
const PAGE_SIZE = 25;
const severityOrder: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };

type Conflict = { id: string; politicianName: string; city: string; conflictType: string; severity: string; agendaItemSummary: string; detectedAt: string };
type SortKey = "severity" | "detectedAt";
type SortDirection = "asc" | "desc";

function ToggleList({ label, options, selected, onChange }: { label: string; options: string[]; selected: string[]; onChange: (value: string[]) => void }) {
  return <fieldset><legend className="mb-2 text-sm font-semibold text-slate-800">{label}</legend><div className="flex flex-wrap gap-x-4 gap-y-2">{options.map((option) => <label key={option} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={selected.includes(option)} onChange={(event) => onChange(event.target.checked ? [...selected, option] : selected.filter((item) => item !== option))} className="h-4 w-4 rounded border-slate-400 text-indigo-700 focus:ring-indigo-600" />{option}</label>)}</div></fieldset>;
}

function badgeClass(severity: string) {
  if (severity.toUpperCase() === "HIGH") return "bg-red-100 text-red-800 ring-red-200";
  if (severity.toUpperCase() === "MEDIUM") return "bg-amber-100 text-amber-800 ring-amber-200";
  return "bg-blue-100 text-blue-800 ring-blue-200";
}

export function meta() {
  return [{ title: "Public conflicts dashboard | FAIR" }, { name: "description", content: "Browse detected public-interest conflicts." }];
}

export default function ConflictsDashboard() {
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [city, setCity] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  const [severities, setSeverities] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("detectedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/conflicts`).then(async (response) => {
      if (!response.ok) throw new Error("The public conflicts list is unavailable right now.");
      return response.json();
    }).then((payload) => { if (!cancelled) setConflicts(Array.isArray(payload.data) ? payload.data : []); }).catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to load conflicts."); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const cities = useMemo(() => [...new Set(conflicts.map((item) => item.city))].sort(), [conflicts]);
  const conflictTypes = useMemo(() => [...new Set(conflicts.map((item) => item.conflictType))].sort(), [conflicts]);
  const availableSeverities = useMemo(() => [...new Set(conflicts.map((item) => item.severity.toUpperCase()))].sort(), [conflicts]);
  const filtered = useMemo(() => conflicts.filter((item) => {
    const date = item.detectedAt.slice(0, 10);
    return (!city || item.city === city) && (!types.length || types.includes(item.conflictType)) && (!severities.length || severities.includes(item.severity.toUpperCase())) && (!fromDate || date >= fromDate) && (!toDate || date <= toDate);
  }).sort((left, right) => {
    const a = sortKey === "severity" ? severityOrder[left.severity.toUpperCase()] ?? 0 : new Date(left.detectedAt).getTime();
    const b = sortKey === "severity" ? severityOrder[right.severity.toUpperCase()] ?? 0 : new Date(right.detectedAt).getTime();
    return sortDirection === "asc" ? a - b : b - a;
  }), [city, conflicts, fromDate, severities, sortDirection, sortKey, toDate, types]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => setPage(1), [city, fromDate, severities, sortDirection, sortKey, toDate, types]);
  function toggleSort(key: SortKey) { if (key === sortKey) setSortDirection((value) => value === "asc" ? "desc" : "asc"); else { setSortKey(key); setSortDirection("desc"); } }

  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 md:px-8"><div className="mx-auto max-w-7xl"><header className="mb-8 border-b border-indigo-200 pb-6"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">FAIR</p><h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Public conflicts dashboard</h1><p className="mt-3 max-w-3xl text-slate-600">Browse detected potential conflicts of interest from public Form 700 disclosures and city agenda items.</p></header>
    <section aria-labelledby="filters-heading" className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-5 flex items-center gap-2"><SlidersHorizontal size={19} aria-hidden="true" className="text-indigo-700" /><h2 id="filters-heading" className="font-semibold">Filter conflicts</h2></div><div className="grid gap-6 lg:grid-cols-4"><label className="text-sm font-semibold text-slate-800">City<select value={city} onChange={(event) => setCity(event.target.value)} className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal"><option value="">All cities</option>{cities.map((value) => <option key={value} value={value}>{value}</option>)}</select></label><ToggleList label="Conflict type" options={conflictTypes} selected={types} onChange={setTypes} /><ToggleList label="Severity" options={availableSeverities} selected={severities} onChange={setSeverities} /><div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold text-slate-800">From<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" /></label><label className="text-sm font-semibold text-slate-800">To<input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" /></label></div></div></section>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800"><AlertCircle className="mr-2 inline" size={18} />{error}</div>}{loading && <p className="rounded-xl bg-white p-8 text-center text-slate-600 shadow-sm">Loading detected conflicts…</p>}
    {!loading && !error && <section aria-label="Detected conflicts" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-5 py-4 text-sm text-slate-600">{filtered.length} conflict{filtered.length === 1 ? "" : "s"} found</div>{visible.length === 0 ? <div className="px-5 py-14 text-center"><h2 className="text-lg font-semibold">No conflicts match these filters</h2><p className="mt-2 text-slate-600">Try clearing a filter or expanding the date range.</p></div> : <><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-100 text-slate-700"><tr><th className="px-4 py-3">Politician</th><th className="px-4 py-3">City</th><th className="px-4 py-3">Conflict type</th><th className="px-4 py-3"><button type="button" onClick={() => toggleSort("severity")} className="underline decoration-dotted underline-offset-4">Severity {sortKey === "severity" && (sortDirection === "asc" ? "↑" : "↓")}</button></th><th className="px-4 py-3">Agenda item</th><th className="px-4 py-3"><button type="button" onClick={() => toggleSort("detectedAt")} className="underline decoration-dotted underline-offset-4">Detected {sortKey === "detectedAt" && (sortDirection === "asc" ? "↑" : "↓")}</button></th></tr></thead><tbody>{visible.map((conflict) => <tr key={conflict.id} className="border-t border-slate-200 hover:bg-indigo-50"><td className="px-4 py-4 font-medium"><Link to={`/conflicts/${conflict.id}`} className="text-indigo-700 underline underline-offset-2">{conflict.politicianName}</Link></td><td className="px-4 py-4">{conflict.city}</td><td className="px-4 py-4">{conflict.conflictType}</td><td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${badgeClass(conflict.severity)}`}>{conflict.severity}</span></td><td className="max-w-sm px-4 py-4 text-slate-700">{conflict.agendaItemSummary}</td><td className="whitespace-nowrap px-4 py-4">{new Date(conflict.detectedAt).toLocaleDateString()}</td></tr>)}</tbody></table></div><nav aria-label="Conflict pages" className="flex items-center justify-between border-t border-slate-200 px-5 py-4"><span className="text-sm text-slate-600">Page {page} of {pageCount}</span><div className="flex gap-2"><button type="button" disabled={page === 1} onClick={() => setPage((current) => current - 1)} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"><ChevronLeft size={16} />Previous</button><button type="button" disabled={page === pageCount} onClick={() => setPage((current) => current + 1)} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50">Next<ChevronRight size={16} /></button></div></nav></>}</section>}</div></main>;
}
