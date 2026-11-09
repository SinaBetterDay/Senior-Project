import { describe, expect, it } from "vitest";
import { renderConflictReportHtml } from "../../src/utils/conflictReportTemplate.js";

describe("conflict report HTML template", () => {
  it("renders FAIR header, filter summary, key conflict fields, and severity totals", () => {
    const html = renderConflictReportHtml({
      generatedAt: "2026-10-11T12:00:00.000Z",
      filters: { scope: "politician", politicianName: "Alex Rivera" },
      conflicts: [
        {
          politicianName: "Alex Rivera",
          city: "Oakland",
          conflictType: "INVESTMENT",
          severity: "HIGH",
          entityName: "Acme Holdings",
          agendaItemSummary: "Contract review",
          meetingDate: "2026-10-02T00:00:00.000Z",
          detectedAt: "2026-10-03T00:00:00.000Z",
          reviewStatus: "pending",
          ruleReference: "Gov. Code 87103",
        },
        { severity: "HIGH" },
        { severity: "MEDIUM" },
      ],
    });

    expect(html).toContain("Financial Accountability &amp; Interest Review");
    expect(html).toContain("Generated Oct 11, 2026");
    expect(html).toContain("Filter summary</strong><span>Politician: Alex Rivera");
    expect(html).toContain("<dt>High</dt><dd>2</dd>");
    expect(html).toContain("<dt>Medium</dt><dd>1</dd>");
    expect(html).toContain("<dt>Low</dt><dd>0</dd>");
    for (const field of ["Alex Rivera", "Oakland", "INVESTMENT", "Acme Holdings", "Contract review", "Oct 2, 2026", "Oct 3, 2026", "pending", "Gov. Code 87103"]) {
      expect(html).toContain(field);
    }
  });

  it.each([
    [{ scope: "all" }, "All conflicts"],
    [{ scope: "city", city: "Oakland" }, "City: Oakland"],
  ])("summarizes report scope %s", (filters, expectedSummary) => {
    const html = renderConflictReportHtml({ filters });

    expect(html).toContain(`Filter summary</strong><span>${expectedSummary}</span>`);
  });

  it("escapes conflict text and describes date-range filters", () => {
    const html = renderConflictReportHtml({
      filters: { scope: "dateRange", fromDate: "2026-10-01", toDate: "2026-10-31" },
      conflicts: [{ politicianName: '<img src=x onerror="alert(1)">', severity: "LOW" }],
    });

    expect(html).toContain("Date range: Oct 1, 2026 to Oct 31, 2026");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).not.toContain('<img src=x onerror="alert(1)">');
  });
});