import { useEffect, useState } from "react";
import { Link } from "react-router";

type SiteHeaderProps = {
  onSearch?: (query: string) => void;
};

type SearchResult = {
  type: string;
  id: string;
  title: string;
  preview: string;
  href: string;
};

type SearchGroups = {
  politicians: SearchResult[];
  agendaItems: SearchResult[];
  conflicts: SearchResult[];
};

type SearchResponse = {
  query: string;
  groups: SearchGroups;
  total: number;
};

const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:3001";

function ResultGroup({
  title,
  results,
}: {
  title: string;
  results: SearchResult[];
}) {
  if (results.length === 0) {
    return null;
  }

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h2>

      <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {results.map((result) => (
          <Link
            key={`${result.type}-${result.id}`}
            to={result.href}
            className="block px-4 py-3 transition hover:bg-slate-50"
          >
            <p className="font-medium text-slate-900">{result.title}</p>
            {result.preview && (
              <p className="mt-1 text-sm text-slate-600">{result.preview}</p>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}

export function SiteHeader({ onSearch }: SiteHeaderProps) {
  const [query, setQuery] = useState("");
  const [searchGroups, setSearchGroups] = useState<SearchGroups | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setSearchGroups(null);
      setIsLoading(false);
      setSearchError("");
      onSearch?.("");
      return;
    }

    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      setSearchError("");
      onSearch?.(trimmedQuery);

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/search?q=${encodeURIComponent(trimmedQuery)}`,
          {
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error("Search request failed");
        }

        const data = (await response.json()) as SearchResponse;
        setSearchGroups(data.groups);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setSearchGroups(null);
        setSearchError("Search is temporarily unavailable.");
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, onSearch]);

  const totalResults = searchGroups
    ? searchGroups.politicians.length +
      searchGroups.agendaItems.length +
      searchGroups.conflicts.length
    : 0;

  return (
    <>
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-4">
          <Link
            to="/"
            className="text-xl font-bold tracking-tight text-slate-900"
            aria-label="FAIR home"
          >
            FAIR
          </Link>

          <form
            role="search"
            className="flex min-w-0 flex-1"
            onSubmit={(event) => event.preventDefault()}
          >
            <label htmlFor="global-search" className="sr-only">
              Search politicians, agenda items, and conflicts
            </label>

            <input
              id="global-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search politicians, agenda items, and conflicts"
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
            />
          </form>

          <nav
            aria-label="Primary navigation"
            className="flex items-center gap-4"
          >
            <Link
              to="/about"
              className="text-sm font-medium text-slate-700 hover:text-blue-700"
            >
              About FAIR
            </Link>
          </nav>
        </div>
      </header>

      {query.trim() && (
        <section
          aria-live="polite"
          className="mx-auto max-w-7xl space-y-6 px-6 py-6"
        >
          {isLoading && (
            <p className="text-sm text-slate-600">Searching FAIR records...</p>
          )}

          {searchError && (
            <p role="alert" className="text-sm text-red-600">
              {searchError}
            </p>
          )}

          {!isLoading && !searchError && searchGroups && totalResults === 0 && (
            <p className="text-slate-600">
              No results found for “{query.trim()}”.
            </p>
          )}

          {!isLoading && !searchError && searchGroups && totalResults > 0 && (
            <div className="space-y-6">
              <ResultGroup
                title="Politicians"
                results={searchGroups.politicians}
              />

              <ResultGroup
                title="Agenda Items"
                results={searchGroups.agendaItems}
              />

              <ResultGroup
                title="Conflicts"
                results={searchGroups.conflicts}
              />
            </div>
          )}
        </section>
      )}
    </>
  );
}