import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { API_URL } from "../adminAuth";

type Profile = {
  name: string;
  officeTitle: string;
  district: string | null;
  city: string | null;
  filings: { id: string; filingYear: number; filerName: string | null }[];
};

export default function PoliticianProfilePage() {
  const { slug } = useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    fetch(`${API_URL}/api/politicians/${encodeURIComponent(slug)}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Politician profile not found.");
        setProfile(result.data);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Could not load profile."));
  }, [slug]);

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-10 text-slate-900">
      <article className="mx-auto max-w-4xl border border-slate-300 bg-white p-6 sm:p-9">
        <Link to="/" className="text-sm font-medium text-emerald-800 underline">FAIR</Link>
        {error ? <p className="mt-8 text-red-800" role="alert">{error}</p> : profile ? <>
          <p className="mt-8 text-xs font-bold uppercase tracking-[0.12em] text-emerald-800">Politician profile</p>
          <h1 className="mt-2 text-3xl font-semibold">{profile.name}</h1>
          <p className="mt-2 text-slate-700">{profile.officeTitle}{profile.district ? ` · ${profile.district}` : ""}{profile.city ? ` · ${profile.city}` : ""}</p>
          <section className="mt-9 border-t border-slate-200 pt-5">
            <h2 className="text-lg font-semibold">Form 700 filings</h2>
            {profile.filings.length ? <ul className="mt-3 divide-y divide-slate-200">{profile.filings.map((filing) => <li key={filing.id} className="flex flex-wrap justify-between gap-2 py-3"><span>{filing.filerName ?? profile.name}</span><span className="font-medium tabular-nums">{filing.filingYear}</span></li>)}</ul> : <p className="mt-3 text-sm text-slate-600">No filings are available for this profile.</p>}
          </section>
        </> : <p className="mt-8 text-sm text-slate-600">Loading profile...</p>}
      </article>
    </main>
  );
}