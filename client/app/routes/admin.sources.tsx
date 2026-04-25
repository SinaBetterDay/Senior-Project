import { useEffect, useState } from "react";
import { Navigate } from "react-router";
import { Menu, Search, User } from "lucide-react";
import { toast } from "react-hot-toast";

type Source = {
  id: string;
  cityName: string;
  sourceType: "Legistar" | "Apify" | "PDF";
  lastSyncTime: string | null;
  totalAgendaItems: number;
  lastError: string | null;
};

function formatDate(date: string | null) {
  if (!date) return "Never";
  return new Date(date).toLocaleString();
}

export default function AdminSourcesPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function loadSources() {
    try {
      setLoadError(null);

      const res = await fetch("http://localhost:3000/api/admin/sources");

      if (!res.ok) {
        throw new Error("Failed to fetch sources");
      }

      const data = await res.json();
      setSources(data);
    } catch (err) {
      console.error("Failed to fetch sources", err);
      setLoadError("Failed to load source data.");
    } finally {
      setLoading(false);
      setLastRefreshed(new Date());
    }
  }

  useEffect(() => {
    const adminStatus = localStorage.getItem("isAdmin") === "true";
    setIsAdmin(adminStatus);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;

    loadSources();

    const interval = setInterval(() => {
      loadSources();
    }, 30000);

    return () => clearInterval(interval);
  }, [isAdmin]);

  async function handleSync(id: string) {
    setSyncingId(id);

    try {
      const res = await fetch(`http://localhost:3000/api/admin/sources/${id}/sync`, {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("Sync failed");
      }

      await loadSources();
      toast.success("Sync completed successfully");
    } catch (err) {
      console.error("Sync failed", err);
      toast.error("Sync failed");
    } finally {
      setSyncingId(null);
    }
  }

  if (isAdmin === null) {
    return null;
  }

  if (!isAdmin) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <div className="min-h-screen bg-[#ececec] text-[#1f1f1f]">
      <header className="bg-[#3f4c97] text-white">
        <div className="flex items-center justify-between px-6 py-5 md:px-10">
          <div className="flex items-center gap-6">
            <button
              type="button"
              className="rounded-md p-1 transition hover:bg-white/10"
            >
              <Menu size={30} />
            </button>

            <div className="leading-tight">
              <p className="text-xs uppercase tracking-wide">California</p>
              <h1 className="text-xl font-semibold md:text-3xl">
                FAIR POLITICAL PRACTICES COMMISSION
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <Search size={30} />
            <User size={30} />
          </div>
        </div>
        <div className="h-2 bg-[#d3b11f]" />
      </header>

      <main className="px-4 py-10 md:px-10">
        <div className="mx-auto max-w-6xl rounded-[2rem] bg-[#d9e3fb] px-6 py-8 shadow-sm md:px-10">
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-semibold text-black md:text-4xl">
              Admin Sources Dashboard
            </h2>
            <div className="mx-auto mt-2 h-1 w-28 rounded bg-[#3f4c97]" />
            <p className="mt-4 text-sm text-gray-700 md:text-base">
              View ingestion source status and trigger manual syncs.
            </p>
            <p className="mt-2 text-xs text-gray-600">
              Last refreshed: {lastRefreshed.toLocaleTimeString()}
            </p>
          </div>

          {loadError && (
            <div className="mb-6 rounded-xl bg-red-100 px-4 py-3 text-sm font-medium text-red-800">
              {loadError}
            </div>
          )}

          {loading ? (
            <div className="rounded-2xl bg-white/70 px-6 py-10 text-center text-base text-gray-700 shadow-sm">
              Loading sources...
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[#8c97b8] bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-gray-900">
                  <thead className="bg-[#3f4c97] text-white">
                    <tr>
                      <th className="px-4 py-4 text-left font-semibold">City</th>
                      <th className="px-4 py-4 text-left font-semibold">Source Type</th>
                      <th className="px-4 py-4 text-left font-semibold">Last Sync</th>
                      <th className="px-4 py-4 text-left font-semibold">Agenda Items</th>
                      <th className="px-4 py-4 text-left font-semibold">Last Error</th>
                      <th className="px-4 py-4 text-left font-semibold">Action</th>
                    </tr>
                  </thead>

                  <tbody className="bg-white">
                    {sources.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                          No data sources found.
                        </td>
                      </tr>
                    ) : (
                      sources.map((source, index) => (
                        <tr
                          key={source.id}
                          className={index !== sources.length - 1 ? "border-b border-gray-200" : ""}
                        >
                          <td className="px-4 py-4">{source.cityName}</td>
                          <td className="px-4 py-4">{source.sourceType}</td>
                          <td className="px-4 py-4">{formatDate(source.lastSyncTime)}</td>
                          <td className="px-4 py-4">{source.totalAgendaItems}</td>
                          <td className="px-4 py-4">
                            {source.lastError ? (
                              <span className="text-red-700">{source.lastError}</span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <button
                              onClick={() => handleSync(source.id)}
                              disabled={syncingId === source.id}
                              className="rounded-full bg-[#3f4c97] px-5 py-2 font-semibold text-white transition hover:bg-[#334085] disabled:opacity-50"
                            >
                              {syncingId === source.id ? "Syncing..." : "Sync now"}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}