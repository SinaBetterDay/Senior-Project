export default function NotFound() {
  return <main className="page-shell">
    <section className="surface mx-auto max-w-2xl p-8 text-center sm:p-12">
      <p className="eyebrow">FAIR · 404</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">Page not found</h1>
      <p className="mt-3 text-slate-600">The page or record you requested could not be found. It may have moved or been removed.</p>
      <a href="/" className="button-primary mt-6">Return home</a>
    </section>
  </main>;
}