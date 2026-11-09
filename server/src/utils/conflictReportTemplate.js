const SEVERITY_ORDER = ["HIGH", "MEDIUM", "LOW"];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(value, fallback = "Not provided") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

function describeScope(filters = {}) {
  switch (filters.scope) {
    case "politician":
      return `Politician: ${filters.politicianName || "Not selected"}`;
    case "city":
      return `City: ${filters.city || "Not selected"}`;
    case "dateRange":
      return `Date range: ${formatDate(filters.fromDate, "Any date")} to ${formatDate(filters.toDate, "Any date")}`;
    default:
      return "All conflicts";
  }
}

function severityTotals(conflicts) {
  const totals = new Map(SEVERITY_ORDER.map(severity => [severity, 0]));
  for (const conflict of conflicts) {
    const severity = String(conflict.severity || "UNKNOWN").toUpperCase();
    totals.set(severity, (totals.get(severity) ?? 0) + 1);
  }
  return [...totals.entries()]
    .filter(([severity, count]) => count > 0 || SEVERITY_ORDER.includes(severity))
    .map(([severity, count]) => ({
      label: severity === "UNKNOWN" ? "Unknown" : `${severity[0]}${severity.slice(1).toLowerCase()}`,
      count,
    }));
}

function reportRow(conflict) {
  return [
    conflict.politicianName,
    conflict.city,
    conflict.conflictType,
    conflict.severity,
    conflict.entityName,
    conflict.agendaItemSummary ?? conflict.agendaItemTitle,
    formatDate(conflict.meetingDate),
    formatDate(conflict.detectedAt),
    conflict.reviewStatus,
    conflict.ruleReference,
  ];
}

export function renderConflictReportHtml({ conflicts = [], filters = {}, generatedAt = new Date() }) {
  const generatedDate = formatDate(generatedAt);
  const rows = conflicts.map(conflict => `<tr>${reportRow(conflict)
    .map(value => `<td>${escapeHtml(value || "Not available")}</td>`)
    .join("")}</tr>`).join("");
  const totals = severityTotals(conflicts)
    .map(({ label, count }) => `<div class="severity-total"><dt>${escapeHtml(label)}</dt><dd>${count}</dd></div>`)
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>FAIR Conflict Report</title>
  <style>
    @page { size: letter landscape; margin: 0.45in; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #17212b; font: 9pt/1.4 Arial, Helvetica, sans-serif; }
    header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #17624c; padding-bottom: 12px; }
    h1, h2, p { margin: 0; }
    h1 { color: #124c3c; font-size: 22pt; line-height: 1.1; }
    .organization { margin-top: 4px; color: #53616b; font-size: 9pt; }
    .generated { color: #53616b; text-align: right; }
    main { padding-top: 16px; }
    h2 { margin-bottom: 8px; color: #17212b; font-size: 12pt; }
    .filter-summary { margin-bottom: 14px; padding: 9px 11px; border-left: 3px solid #17624c; background: #f1f6f3; }
    .filter-summary strong { margin-right: 5px; }
    .severity-totals { display: flex; gap: 18px; margin: 0 0 18px; }
    .severity-total { min-width: 88px; padding: 8px 11px; border: 1px solid #d8e0dd; }
    .severity-total dt { color: #53616b; font-size: 8pt; }
    .severity-total dd { margin: 3px 0 0; font-size: 16pt; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 7.5pt; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; }
    th { background: #eaf1ee; color: #17212b; text-align: left; }
    th, td { border: 1px solid #d5ddda; padding: 5px 6px; vertical-align: top; overflow-wrap: anywhere; }
    .table-count { margin: 0 0 6px; color: #53616b; font-size: 8pt; }
  </style>
</head>
<body>
  <header>
    <div><h1>FAIR</h1><p class="organization">Financial Accountability &amp; Interest Review</p><p>Conflict Summary Report</p></div>
    <p class="generated">Generated ${escapeHtml(generatedDate)}</p>
  </header>
  <main>
    <section class="filter-summary"><strong>Filter summary</strong><span>${escapeHtml(describeScope(filters))}</span></section>
    <section aria-labelledby="severity-heading"><h2 id="severity-heading">Totals by severity</h2><dl class="severity-totals">${totals}</dl></section>
    <section aria-labelledby="conflicts-heading"><h2 id="conflicts-heading">Conflicts</h2><p class="table-count">${conflicts.length} conflict${conflicts.length === 1 ? "" : "s"}</p>
      <table>
        <thead><tr><th>Politician</th><th>City</th><th>Conflict type</th><th>Severity</th><th>Disclosed interest</th><th>Agenda item</th><th>Meeting date</th><th>Detected</th><th>Review status</th><th>FPPC rule reference</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="10">No conflicts matched these filters.</td></tr>'}</tbody>
      </table>
    </section>
  </main>
</body>
</html>`;
}