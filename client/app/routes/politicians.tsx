import { useEffect, useState } from "react";
import { Link } from "react-router";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

type Politician = { // from the backend
  id: string;
  fullName: string;
  district: string | null;
  conflictCount: number;
};

export function meta() {
  return [
    { title: "Politicians" },
    {
      name: "description",
      content: "View politicians and their flagged conflicts",
    },
  ];
}

export default function Politicians() {
  const [politicians, setPoliticians] = useState<Politician[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {  // fetches data
    async function fetchPoliticians() {
      try {
        const response = await fetch(`${API_URL}/api/politicians`);

        if (!response.ok) {
          throw new Error("Failed to fetch politicians");
        }

        const result = await response.json();
        setPoliticians(result.data);
      } catch (error) {
        console.error("Failed to fetch politicians:", error);
        setError("Unable to load politicians.");
      } finally {
        setLoading(false);
      }
    }

    fetchPoliticians();
  }, []);

  if (loading) {
    return (
      <main>
        <h1>Politicians</h1>
        <p>Loading politicians...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main>
        <h1>Politicians</h1>
        <p>{error}</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Politicians</h1>

      {politicians.length === 0 ? (
        <p>No politicians found.</p>
      ) : (
        <ul>
          {politicians.map((politician) => (
            <li key={politician.id}>
              <h2>
                <Link to={`/politicians/${politician.id}`}> 
                    {politician.fullName}
                </Link>
              </h2>

              <p>
                District: {politician.district ?? "Not available"}
              </p>

              <p>
                Flagged conflicts: {politician.conflictCount}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}