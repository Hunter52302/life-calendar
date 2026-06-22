// Plain fetch calls to the user's own LLM provider — no SDK, no backend proxy.
// The API key goes straight from this browser to the provider (or custom
// endpoint); it never passes through any third party.

function buildPrompt(text, todayStr) {
  return [
    `Today's date is ${todayStr}.`,
    'Extract every distinct calendar event mentioned in the text below.',
    'Respond with ONLY a JSON array (no prose, no markdown code fences) of objects shaped exactly like:',
    '[{"title": "string", "date": "YYYY-MM-DD", "start_time": "HH:MM", "end_time": "HH:MM", "category_guess": "string"}]',
    'Resolve relative dates (e.g. "tomorrow", "next Friday") against today\'s date.',
    'If no end time is stated, infer a reasonable duration.',
    '',
    'Text:',
    text,
  ].join('\n');
}

function stripJsonFences(raw) {
  return raw.replace(/```json/gi, '```').replace(/```/g, '').trim();
}

function addOneHour(hhmm) {
  if (!hhmm) return '10:00';
  const [h, m] = hhmm.split(':').map(Number);
  return `${String((h + 1) % 24).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}`;
}

async function callAnthropic({ apiKey, model }, prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: model || 'claude-3-5-haiku-latest',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic request failed: ${res.status}`);
  const data = await res.json();
  return (data.content ?? []).map(c => c.text ?? '').join('');
}

async function callOpenAI({ apiKey, model }, prompt) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI request failed: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

async function callCustom({ endpoint, model }, prompt) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], stream: false }),
  });
  if (!res.ok) throw new Error(`Custom LLM endpoint request failed: ${res.status}`);
  const data = await res.json();
  return data.message?.content ?? data.response ?? '';
}

/**
 * Calls the user's configured LLM and maps results into parseEvents()'s draft
 * shape, plus a `categoryGuess` the caller can run through matchCategory().
 * Throws on any failure — callers fall back to the local parser.
 */
export async function parseWithLLM(text, llmSettings, referenceDate = new Date()) {
  const { provider, apiKey, endpoint, model } = llmSettings;
  const prompt = buildPrompt(text, referenceDate.toISOString().slice(0, 10));

  let raw;
  if (provider === 'anthropic')   raw = await callAnthropic({ apiKey, model }, prompt);
  else if (provider === 'openai') raw = await callOpenAI({ apiKey, model }, prompt);
  else if (provider === 'custom') raw = await callCustom({ endpoint, model }, prompt);
  else throw new Error(`Unknown LLM provider: ${provider}`);

  const items = JSON.parse(stripJsonFences(raw));
  if (!Array.isArray(items)) throw new Error('LLM response was not a JSON array');

  return items.map(item => ({
    label: item.title || 'Event',
    startDate: item.date,
    startTime: item.start_time || '09:00',
    endDate: item.date,
    endTime: item.end_time || addOneHour(item.start_time),
    confidence: 'high',
    categoryGuess: item.category_guess ?? null,
  }));
}
