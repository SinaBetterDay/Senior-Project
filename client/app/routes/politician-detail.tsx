import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

type Filing = {
  id: string;
  filingYear: number;
  filedAt: string | null;
  filerName: string | null;
};

type Conflict = {
  id: string;
  conflictType: string;
  severity: string;
  entityName: string | null;
  ruleReference: string;
  detectedAt: string;
  agendaItemId: string;
  agendaItem: {
    id: string;
    title: string | null;
    meetingDate: string | null;
  };
};

type Politician = {
  id: string;
  fullName: string;
  district: string | null;
  filings: Filing[];
  conflicts: Conflict[];
};

export function meta() {
  return [
    { title: "Politician Profile" },
    {
      name: "description",
      content: "View politician filings and flagged conflicts",
    },
  ];
}

export default function PoliticianDetail() {
  const { id } = useParams();

  const [politician, setPolitician] = useState<Politician | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchPolitician() {
        try {
            const response = await fetch(`${API_URL}/api/politicians/id/${id}`);
            
            if (!response.ok) {
                throw new Error("Failed to fetch politician");
            }
            
            const result = await response.json();
            setPolitician(result.data);
        } catch (error) {
            console.error("Failed to fetch politician:", error);
            setError("Unable to load politician.");
        } finally {
            setLoading(false);
        }
    }
    
    fetchPolitician();
}, [id]);

if (loading) {
  return (
    <main>
      <h1>Politician Profile</h1>
      <p>Loading politician...</p>
    </main>
  );
}

if (error) {
  return (
    <main>
      <h1>Politician Profile</h1>
      <p>{error}</p>
    </main>
  );
}

if (!politician) {
  return (
    <main>
      <h1>Politician Profile</h1>
      <p>Politician not found.</p>
    </main>
  );
}

  return (
  <main>
    <h1>{politician.fullName}</h1>

    <p>
      District: {politician.district ?? "Not available"}
    </p>

    <section>
      <h2>Form 700 Filings</h2>

      {politician.filings.length === 0 ? (
        <p>No Form 700 filings found.</p>
      ) : (
        <ul>
          {politician.filings.map((filing) => (
            <li key={filing.id}>
              <strong>Filing year:</strong> {filing.filingYear}
              {filing.filedAt && (
                <p>
                  Filed: {new Date(filing.filedAt).toLocaleDateString()}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
    <section>
        <h2>Flagged Conflicts</h2>

        {politician.conflicts.length === 0 ? (
          <p>No flagged conflicts found.</p>
        ) : (
            <ul>
                {politician.conflicts.map((conflict) => (
                    <li key={conflict.id}>
                      <h3>
                        <Link to={`/conflicts/${conflict.id}`}>
                        {conflict.conflictType}
                        </Link>
                      </h3>

                      <p>
                        <strong>Severity:</strong> {conflict.severity}
                      </p>

                      {conflict.entityName && (
                        <p>
                          <strong>Entity:</strong> {conflict.entityName}
                        </p>
                      )}

                      <p>
                        <strong>Rule:</strong> {conflict.ruleReference}
                      </p>

                      <p>
                        <strong>Agenda item:</strong>{" "}
                        <Link to={`/agenda/${conflict.agendaItemId}`}>
                          {conflict.agendaItem.title ?? "View agenda item"}
                        </Link>
                      </p>
                    </li>
                ))}
            </ul>
        )}
    </section>
  </main>
);
}