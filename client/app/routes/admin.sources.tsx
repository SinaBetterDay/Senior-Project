import { useState } from "react";
import { Navigate } from "react-router";

type Source = {
  id: string;
  cityName: string;
  sourceType: "Legistar" | "Apify" | "PDF";
  lastSyncTime: string | null;
  totalAgendaItems: number;
  lastError: string | null;
};

const mockSources: Source[] = [
  {
    id: "sac-legistar",
    cityName: "Sacramento",
    sourceType: "Legistar",
    lastSyncTime: "2026-04-18T09:15:00Z",
    totalAgendaItems: 245,
    lastError: null,
  },
  {
    id: "elk-apify",
    cityName: "Elk Grove",
    sourceType: "Apify",
    lastSyncTime: "2026-04-17T18:40:00Z",
    totalAgendaItems: 98,
    lastError: "Timeout while scraping",
  },
  {
    id: "fresno-pdf",
    cityName: "Fresno",
    sourceType: "PDF",
    lastSyncTime: null,
    totalAgendaItems: 0,
    lastError: null,
  },
];

function formatDate(date: string | null) {
  if (!date) return "Never";
  return new Date(date).toLocaleString();
}

export default function AdminSourcesPage() {
  const isAdmin = true;

  const [sources, setSources] = useState<Source[]>(mockSources);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  if (!isAdmin) {
    return <Navigate to="/admin/login" replace />;
  }

  function handleSync(id: string) {
    setSyncingId(id);

    setTimeout(() => {
      setSources((prev) =>
        prev.map((source) =>
          source.id === id
            ? {
                ...source,
                lastSyncTime: new Date().toISOString(),
                lastError: null,
              }
            : source
        )
      );

      setSyncingId(null);
      alert("Sync complete!");
    }, 1500);
  }

  return (
    <div className="p-6">
      <h1 className="mb-2 text-2xl font-bold">Data Sources Status</h1>
      <p className="mb-6 text-sm text-gray-600">
        View ingestion source status and trigger manual syncs.
      </p>

      <div className="overflow-x-auto rounded-xl border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left">City</th>
              <th className="px-4 py-3 text-left">Source Type</th>
              <th className="px-4 py-3 text-left">Last Sync</th>
              <th className="px-4 py-3 text-left">Agenda Items</th>
              <th className="px-4 py-3 text-left">Last Error</th>
              <th className="px-4 py-3 text-left">Action</th>
            </tr>
          </thead>

          <tbody>
            {sources.map((source) => (
              <tr key={source.id} className="border-t">
                <td className="px-4 py-3">{source.cityName}</td>
                <td className="px-4 py-3">{source.sourceType}</td>
                <td className="px-4 py-3">{formatDate(source.lastSyncTime)}</td>
                <td className="px-4 py-3">{source.totalAgendaItems}</td>
                <td className="px-4 py-3">{source.lastError || "—"}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleSync(source.id)}
                    disabled={syncingId === source.id}
                    className="rounded-lg bg-black px-3 py-2 text-white disabled:opacity-50"
                  >
                    {syncingId === source.id ? "Syncing..." : "Sync now"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}