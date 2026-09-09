import Fuse from "fuse.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { MATCH_BANDS } from "../config/conflictRules.js";

const ENTITY_SUFFIXES =
  /\b(llc|inc|incorporated|corp|corporation|ltd|limited|co|company)\.?$/i;

export function pickField(row, ...keys) {
  if (!row) return undefined;
  for (const key of keys) {
    if (row[key] != null && row[key] !== "") return row[key];
  }
  return undefined;
}

export function collapseText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeEntityName(name) {
  let text = collapseText(name);
  if (!text) return "";

  let prev;
  do {
    prev = text;
    text = text.replace(ENTITY_SUFFIXES, "").trim();
  } while (text !== prev);

  return text;
}

export function getAgendaText(item = {}) {
  return [item.item_text, item.itemText, item.description, item.title]
    .filter((value) => value != null && String(value).trim() !== "")
    .join("\n");
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsPhrase(haystack, needle) {
  if (!haystack || !needle) return false;
  return new RegExp(`\\b${escapeRegex(needle)}\\b`).test(haystack);
}

export function scoreEntityInText(name, agendaText) {
  const needle = normalizeEntityName(name);
  const haystack = collapseText(agendaText);
  if (!needle || !haystack) return 0;

  if (containsPhrase(haystack, needle)) return 1;

  const needleWords = needle.split(" ");
  const hayWords = haystack.split(" ");
  const n = Math.max(1, needleWords.length);
  const windows = [];

  if (hayWords.length <= n) {
    windows.push(haystack);
  } else {
    for (let i = 0; i <= hayWords.length - n; i++) {
      windows.push(hayWords.slice(i, i + n).join(" "));
    }
  }

  const fuse = new Fuse(
    windows.map((text) => ({ text })),
    {
      keys: ["text"],
      includeScore: true,
      ignoreLocation: true,
      threshold: 1,
    },
  );
  const results = fuse.search(needle);
  if (!results.length) return 0;
  return 1 - results[0].score;
}

function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY || process.env.LLM_API_KEY || "";
}

export async function resolveEntityWithGemini(name, agendaText) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return false;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
You are helping decide whether an agenda item refers to a named entity from a Form 700 disclosure.

Return ONLY JSON in this format:
{
  "isMatch": true
}

Use true if the agenda item is about this entity.
Use false if it is a different organization or the entity is not referenced.

Entity name: "${name}"
Agenda item text: "${String(agendaText || "").slice(0, 4000)}"

Rules:
- Ignore punctuation, casing, and suffixes such as LLC, Inc, Corp, Corporation, Ltd, Co, Company.
- Do not match clearly different organizations.
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
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

export async function matchNamedEntity(name, agendaText, deps = {}) {
  const scoreFn = deps.scoreEntityInText ?? scoreEntityInText;
  const score = scoreFn(name, agendaText);
  const result = { matched: false, score, usedGemini: false };

  if (score >= MATCH_BANDS.AUTO_MATCH) {
    result.matched = true;
    return result;
  }

  if (score < MATCH_BANDS.GEMINI_MIN) {
    return result;
  }

  result.usedGemini = true;
  const resolve = deps.resolveWithGemini ?? resolveEntityWithGemini;
  try {
    result.matched = (await resolve(name, agendaText)) === true;
  } catch {
    result.matched = false;
  }
  return result;
}
