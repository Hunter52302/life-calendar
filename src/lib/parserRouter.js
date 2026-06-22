import { parseEvents } from './parseEvents.js';
import { parseWithLLM } from './llmParser.js';
import { matchCategory } from './categoryMatcher.js';

function withLocalParser(text, keywordMap) {
  return parseEvents(text).map(d => ({ ...d, catId: matchCategory(d.label, keywordMap) }));
}

/**
 * Tier 1 (default): the free, local, offline-capable parser.
 * Tier 2 (opt-in): the user's own LLM, falling back to Tier 1 silently on
 * any failure — text parsing must never hard-error just because a key or
 * endpoint is misconfigured.
 */
export async function parseEventText(text, llmSettings, keywordMap = {}) {
  if (!llmSettings || llmSettings.provider === 'none') {
    return withLocalParser(text, keywordMap);
  }
  try {
    const results = await parseWithLLM(text, llmSettings);
    return results.map(d => ({ ...d, catId: matchCategory(`${d.categoryGuess ?? ''} ${d.label}`, keywordMap) }));
  } catch (err) {
    console.warn('LLM parsing failed, falling back to the local parser:', err);
    return withLocalParser(text, keywordMap);
  }
}
