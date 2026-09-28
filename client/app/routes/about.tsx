export function meta() {
  return [
    { title: "About" },
    {
  name: "description",
  content:
    "Learn how FAIR uses public records to explain Form 700 filings and potential conflicts of interest.",
},
  ];
}

export default function About() {
  return (
  <main className="mx-auto max-w-4xl space-y-10 px-6 py-12">
    <header className="space-y-4">
      <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
        About FAIR
      </p>

      <h1 className="text-4xl font-bold tracking-tight text-slate-900">
        Financial Accountability & Interest Review
      </h1>

      <p className="max-w-3xl text-lg leading-8 text-slate-600">
        FAIR is a full-stack compliance platform built for the California Fair
        Political Practices Commission, or FPPC. It helps analysts and the
        public understand when local officials’ financial disclosures may
        overlap with city council agenda items.
      </p>
    </header>

    <section className="space-y-3">
      <h2 className="text-2xl font-semibold text-slate-900">
        What is FAIR?
      </h2>

      <p className="leading-7 text-slate-700">
        FAIR brings information about elected officials, government meetings,
        financial disclosures, and possible conflicts of interest together in
        one searchable platform.
      </p>

      <p className="leading-7 text-slate-700">
        The public can browse officials, agenda items, and flagged overlaps
        without logging in. FAIR is an informational tool. It does not decide
        whether someone broke a law or determine that a conflict definitely
        exists.
      </p>
    </section>

    <section className="space-y-3">
      <h2 className="text-2xl font-semibold text-slate-900">
        Where does FAIR get its information?
      </h2>

      <p className="leading-7 text-slate-700">
        FAIR collects structured city agenda data, PDF city agendas, and Form
        700 disclosure spreadsheets uploaded by authorized administrators.
        These records are organized so related information can be reviewed
        together.
      </p>

      <p className="leading-7 text-slate-700">
        The system uses automated data processing to identify officials,
        agenda items, financial interests, and possible relationships between
        them. Ambiguous matches can be reviewed by administrators.
      </p>
    </section>

    <section className="space-y-3">
      <h2 className="text-2xl font-semibold text-slate-900">
        What is Form 700?
      </h2>

      <p className="leading-7 text-slate-700">
        Form 700 is California’s Statement of Economic Interests. Certain
        public officials and employees use it to disclose financial interests
        that could affect their government decisions.
      </p>

      <p className="leading-7 text-slate-700">
        These disclosures can include investments, real property, income,
        gifts, travel payments, and business positions. FAIR helps organize
        this information so visitors can more easily understand what was
        reported.
      </p>
    </section>

    <section className="space-y-3">
      <h2 className="text-2xl font-semibold text-slate-900">
        How does conflict detection work?
      </h2>

      <p className="leading-7 text-slate-700">
        FAIR compares information from Form 700 disclosures with city council
        agenda items and other public records. When the information matches one
        of the project’s detection rules, FAIR creates a possible conflict
        record.
      </p>

      <p className="leading-7 text-slate-700">
        A possible conflict is a prompt for review, not a final conclusion.
        Visitors should read the related records and consult the appropriate
        government agency before making decisions based on the information.
      </p>
    </section>

    <section className="space-y-3">
      <h2 className="text-2xl font-semibold text-slate-900">
        Who uses FAIR?
      </h2>

      <p className="leading-7 text-slate-700">
        Members of the public can browse officials, agendas, and possible
        conflicts without an account. Authorized FPPC administrators can
        upload Form 700 files, manage data sources, and review conflict flags.
      </p>
    </section>

    <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-6">
      <h2 className="text-2xl font-semibold text-slate-900">
        FPPC contact information
      </h2>

      <p className="leading-7 text-slate-700">
        The California Fair Political Practices Commission provides official
        guidance about California’s Political Reform Act and Form 700
        requirements.
      </p>

      <div className="space-y-5 text-slate-700">
        <div>
          <h3 className="font-semibold text-slate-900">
            General information
          </h3>
          <p>
            <a
              href="tel:9163225660"
              className="text-blue-700 underline hover:text-blue-900"
            >
              (916) 322-5660
            </a>
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-slate-900">
            Political Reform Act advice
          </h3>
          <p>
            <a
              href="tel:18662753772"
              className="text-blue-700 underline hover:text-blue-900"
            >
              1-866-ASK-FPPC (866) 275-3772, option 1
            </a>
          </p>
          <p>
            <a
              href="mailto:advice@fppc.ca.gov"
              className="text-blue-700 underline hover:text-blue-900"
            >
              advice@fppc.ca.gov
            </a>
          </p>
          <p className="text-sm text-slate-600">
            Advice is available Monday through Thursday, 9:00 a.m. to 11:30
            a.m.
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-slate-900">
            Public record requests
          </h3>
          <p>
            Phone:{" "}
            <a
              href="tel:9164452772"
              className="text-blue-700 underline hover:text-blue-900"
            >
              (916) 445-2772
            </a>
          </p>
          <p>
            Email:{" "}
            <a
              href="mailto:cpra@fppc.ca.gov"
              className="text-blue-700 underline hover:text-blue-900"
            >
              cpra@fppc.ca.gov
            </a>
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-slate-900">
            Form 700 requests
          </h3>
          <p>
            <a
              href="tel:18662753772"
              className="text-blue-700 underline hover:text-blue-900"
            >
              1-866-ASK-FPPC (866) 275-3772, option 2
            </a>
          </p>
          <p>
            <a
              href="mailto:form700@fppc.ca.gov"
              className="text-blue-700 underline hover:text-blue-900"
            >
              form700@fppc.ca.gov
            </a>
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-slate-900">
            Enforcement
          </h3>
          <p>
            <a
              href="mailto:intake@fppc.ca.gov"
              className="text-blue-700 underline hover:text-blue-900"
            >
              intake@fppc.ca.gov
            </a>
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-slate-900">
            Agenda comments
          </h3>
          <p>
            <a
              href="mailto:commasst@fppc.ca.gov"
              className="text-blue-700 underline hover:text-blue-900"
            >
              commasst@fppc.ca.gov
            </a>
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-slate-900">
            Website comments and suggestions
          </h3>
          <p>
            <a
              href="mailto:webmaster@fppc.ca.gov"
              className="text-blue-700 underline hover:text-blue-900"
            >
              webmaster@fppc.ca.gov
            </a>
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-slate-900">
            Media inquiries
          </h3>
          <p>
            Phone:{" "}
            <a
              href="tel:9163227761"
              className="text-blue-700 underline hover:text-blue-900"
            >
              (916) 322-7761
            </a>
          </p>
          <p>
            Email:{" "}
            <a
              href="mailto:press@fppc.ca.gov"
              className="text-blue-700 underline hover:text-blue-900"
            >
              press@fppc.ca.gov
            </a>
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-slate-900">
            Speaker requests
          </h3>
          <p>
            <a
              href="tel:9163278269"
              className="text-blue-700 underline hover:text-blue-900"
            >
              (916) 327-8269
            </a>
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-slate-900">
            Other FPPC information
          </h3>
          <p>
            Fax for general information and public record requests:{" "}
            <a
              href="tel:9163220886"
              className="text-blue-700 underline hover:text-blue-900"
            >
              (916) 322-0886
            </a>
          </p>
          <p>
            FPPC Electronic Filing System:{" "}
            <a
              href="mailto:form700@fppc.ca.gov"
              className="text-blue-700 underline hover:text-blue-900"
            >
              form700@fppc.ca.gov
            </a>
          </p>
        </div>

        <p className="pt-2">
          <a
            href="https://www.fppc.ca.gov/"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-blue-700 underline hover:text-blue-900"
          >
            Visit the official FPPC website
          </a>
        </p>
      </div>
    </section>
  </main>
);
}