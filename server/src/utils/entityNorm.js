const ENTITY_SUFFIXES = new Set([
  "llc",
  "inc",
  "incorporated",
  "corp",
  "corporation",
  "ltd",
  "limited",
  "co",
  "company",
]);

/**
 * Convert an organization name into a stable form for comparisons.
 *
 * This intentionally removes only common legal business suffixes after
 * normalizing punctuation and whitespace, so meaningful words remain intact.
 */
export function normalizeEntityName(name) {
  let normalized = String(name ?? "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return "";

  const words = normalized.split(" ");
  while (words.length > 0 && ENTITY_SUFFIXES.has(words.at(-1))) {
    words.pop();
  }

  return words.join(" ");
}

function levenshteinDistance(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + substitutionCost,
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length];
}

/**
 * Compare two organization names after normalization. Empty values are never
 * considered a match because they do not identify an entity.
 */
export function areSameEntity(nameA, nameB) {
  const normalizedA = normalizeEntityName(nameA);
  const normalizedB = normalizeEntityName(nameB);

  if (!normalizedA || !normalizedB) return false;
  if (normalizedA === normalizedB) return true;

  const longestLength = Math.max(normalizedA.length, normalizedB.length);
  const similarity = 1 - levenshteinDistance(normalizedA, normalizedB) / longestLength;
  return similarity >= 0.88;
}
