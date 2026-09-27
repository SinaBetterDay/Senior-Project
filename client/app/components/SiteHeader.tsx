import { useEffect, useState } from "react";
import { Link } from "react-router";

type SiteHeaderProps = {
  onSearch?: (query: string) => void;
};

export function SiteHeader({ onSearch }: SiteHeaderProps) {
  const [query, setQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const trimmedQuery = query.trim();

      onSearch?.(trimmedQuery);
      setHasSearched(Boolean(trimmedQuery));
    }, 300);

    return () => window.clearTimeout(timer);
  }, [query, onSearch]);

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

      {query.trim().length > 0 && (
        <p className="mx-auto max-w-7xl px-6 py-6 text-slate-600">
          No results found for “{query}”.
        </p>
      )}
    </>
  );
}