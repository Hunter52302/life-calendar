/**
 * Suggests a category for a parsed event label by keyword substring match.
 * keywordMap: { [categoryId]: string[] } — as returned by api.categoryKeywords.get().
 * Returns the first matching category id, or null if nothing matches.
 */
export function matchCategory(label, keywordMap) {
  if (!label || !keywordMap) return null;
  const lower = label.toLowerCase();
  for (const [categoryId, keywords] of Object.entries(keywordMap)) {
    if (keywords.some(kw => lower.includes(kw.toLowerCase()))) return categoryId;
  }
  return null;
}
