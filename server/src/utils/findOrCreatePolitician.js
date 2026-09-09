import Fuse from "fuse.js";
import { supabase } from "../supabaseClient.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Variables for match score comparison
const AUTO_MATCH_THRESHOLD = 0.85;
const GEMINI_MIN_THRESHOLD = 0.7;


// Office title used when a filer is auto-created and the cover page did not
// provide one. Admins fix this up via the needs_review queue.
const DEFAULT_OFFICE_TITLE = "Unknown";

// Postgres unique_violation — used to retry slug generation on collision.
const PG_UNIQUE_VIOLATION = "23505";

// normalize name of politician: lowercase, remove periods, trim spaces
function normalizeName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/,/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// URL-safe slug for the politicians.slug unique column
export function slugifyName(name) {
  const slug = normalizeName(name)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "politician";
}

// query supabase politicians table (schema v2: politicians.full_name)
async function getPoliticianCandidates(district) {
  let query = supabase
    .from("politicians")
    .select("id, full_name, district");

  if (district) {
    query = query.eq("district", district);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Error fetching politicians: ${error.message}`);
  }

  return data.map((politician) => ({
    ...politician,
    normalized_name: normalizeName(politician.full_name),
  }));
}

async function getBestFuseMatch(filerName, district) {
  const candidates = await getPoliticianCandidates(district);

  if (candidates.length === 0) {
    return null;
  }

  const fuse = new Fuse(candidates, {
    keys: ["normalized_name"],
    includeScore: true,
    threshold: 0.4,
    ignoreLocation: true,
  });

  const results = fuse.search(normalizeName(filerName));

  if (results.length === 0) {
    return null;
  }

  const best = results[0];

  return {
    politician: best.item,
    fuseScore: best.score,
    confidence: 1 - best.score,
  };
  
}

async function resolveWithGemini(filerName, candidate, district) {
  if (!process.env.GEMINI_API_KEY) {
    return false;
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
  });

  const prompt = `
You are helping resolve whether two politician records refer to the same person.

Return ONLY JSON in this format:
{
  "isMatch": true
}

Use true if they are likely the same person.
Use false if they are likely different people.

Filer name: "${filerName}"
Existing politician name: "${candidate.full_name}"
Filer district: "${district || "unknown"}"
Existing politician district: "${candidate.district || "unknown"}"

Rules:
- Middle initials may be ignored.
- Missing middle names may be ignored.
- Minor punctuation differences may be ignored.
- Do not match clearly different people.
`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    //clean the text
    const cleanedText = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(cleanedText);
    return parsed.isMatch === true;
  } catch {
    return false;
  }
}

// insert a new politicians row; retries once with a random slug suffix if the
// name-derived slug is already taken
async function createPolitician(cleanedName, district, officeTitle) {
  const baseSlug = slugifyName(cleanedName);
  const attempts = [baseSlug, `${baseSlug}-${Math.random().toString(36).slice(2, 8)}`];

  let lastError = null;

  for (const slug of attempts) {
    const { data, error } = await supabase
      .from("politicians")
      .insert({
        full_name: cleanedName,
        slug,
        office_title: officeTitle,
        district,
        needs_review: true,
      })
      .select("id")
      .single();

    if (!error) {
      return data.id;
    }

    lastError = error;
    if (error.code !== PG_UNIQUE_VIOLATION) {
      break;
    }
  }

  throw new Error(`Error creating politician: ${lastError?.message ?? "unknown error"}`);
}

// main function
// options.officeTitle: office title from the Form 700 cover page (optional)
export async function findOrCreatePolitician(filerName, district, options = {}) {
  const cleanedName = String(filerName || "").trim();

  if (!cleanedName) {
    throw new Error("filerName cannot be empty");
  }

  // fuzzy matching using fuse.js
  const bestMatch = await getBestFuseMatch(cleanedName, district);

  // check if score meets fuse match criteria
  if (bestMatch && bestMatch.confidence >= AUTO_MATCH_THRESHOLD) {
    return bestMatch.politician.id;
  }

  // if match score is unclear, use Gemini
  if (
    bestMatch &&
    bestMatch.confidence >= GEMINI_MIN_THRESHOLD &&
    bestMatch.confidence < AUTO_MATCH_THRESHOLD
  ) {
    const confirmed = await resolveWithGemini(
      cleanedName,
      bestMatch.politician,
      district
    );

    if (confirmed) {
      return bestMatch.politician.id;
    }
  }

  // if there is no match, create a new row flagged for admin review
  const officeTitle = String(options.officeTitle || "").trim() || DEFAULT_OFFICE_TITLE;
  return createPolitician(cleanedName, district ?? null, officeTitle);
}

