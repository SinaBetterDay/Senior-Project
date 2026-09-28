import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

type Conflict = {
  id: string;
  conflictType: string;
  severity: string;
  entityName: string | null;
  ruleReference: string;
  detectedAt: string;
  politician: {
    id: string;
    fullName: string;
    district: string | null;
  };
};

type AgendaItem = {
  id: string;
  title: string | null;
  description: string | null;
  itemText: string | null;
  itemNumber: string | null;
  meetingDate: string | null;
  cityName: string | null;
  sourceType: string;
  bodyName: string | null;
  conflicts: Conflict[];
};

export function meta() {
  return [
    { title: "Agenda Item" },
    {
      name: "description",
      content: "View agenda item details and linked conflicts",
    },
  ];
}

export default function AgendaDetail() {
  const { id } = useParams();

  const [agendaItem, setAgendaItem] = useState<AgendaItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // API request
  useEffect(() => {
    async function fetchAgendaItem() {
        try {
            const response = await fetch(`${API_URL}/api/agenda/${id}`);
            
            if (!response.ok) {
                throw new Error("Failed to fetch agenda item");
            }
            
            const result = await response.json();
            setAgendaItem(result.data);
        } catch (error) {
            console.error("Failed to fetch agenda item:", error);
            setError("Unable to load agenda item.");
        } finally {
            setLoading(false);
        }
    }
    
    fetchAgendaItem();
}, [id]);
  // loading/error protection
  if (loading) {
    return (
      <main>
        <h1>Agenda Item</h1>
        <p>Loading agenda item...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main>
        <h1>Agenda Item</h1>
        <p>{error}</p>
      </main>
    );
  }

  if (!agendaItem) {
    return (
      <main>
        <h1>Agenda Item</h1>
        <p>Agenda item not found.</p>
      </main>
    );
  }

  return (
    <main>
      <h1>{agendaItem.title ?? "Agenda Item"}</h1>

      {agendaItem.itemNumber && (
        <p>
          <strong>Item number:</strong> {agendaItem.itemNumber}
        </p>
      )}

      <p>
        <strong>Meeting date:</strong>{" "}
        {agendaItem.meetingDate
          ? new Date(agendaItem.meetingDate).toLocaleDateString()
          : "Not available"}
      </p>

      <p>
        <strong>City:</strong> {agendaItem.cityName ?? "Not available"}
      </p>

      <p>
        <strong>Source type:</strong> {agendaItem.sourceType}
      </p>

      <section>
        <h2>Agenda Item Text</h2>
        <p>
          {agendaItem.itemText ??
            agendaItem.description ??
            "No agenda item text available."}
        </p>
      </section>
      <section>
        <h2>Linked Conflicts</h2>

        {agendaItem.conflicts.length === 0 ? (
          <p>No flagged conflicts found.</p>
        ) : (
          <ul>
            {agendaItem.conflicts.map((conflict) => (
              <li key={conflict.id}>
                <h3>{conflict.conflictType}</h3>
                
                <p> 
                  <strong>Politician:</strong>{" "}
                  <Link to={`/politicians/${conflict.politician.id}`}>
                    {conflict.politician.fullName}
                  </Link>
                </p>

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
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}