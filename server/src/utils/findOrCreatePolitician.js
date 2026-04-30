import Fuse from "fuse.js";
import { supabase } from "../supabaseClient.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Variables for match score comparison
const AUTO_MATCH_THRESHOLD = 0.85;
const GEMINI_MIN_THRESHOLD = 0.7;


// normalize name of politician: lowercase, remove periods, trim spaces
function normalizeName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/,/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// query supabase politicians table
async function getPoliticianCandidates(district) {
  let query = supabase
    .from("politicians")
    .select("id, name, district");

  if (district) {
    query = query.eq("district", district);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Error fetching politicians: ${error.message}`);
  }

  return data.map((politician) => ({
    ...politician,
    normalized_name: normalizeName(politician.name),
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
Existing politician name: "${candidate.name}"
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

// main function
export async function findOrCreatePolitician(filerName, district) {
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

  // if there is no match
  const { data, error } = await supabase
    .from("politicians")
    .insert({
      name: cleanedName,
      district,
      needs_review: true,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Error creating politician: ${error.message}`);
  }

  return data.id;
}

