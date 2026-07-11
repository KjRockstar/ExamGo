const { getSubject } = require('../data');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
const CACHE_TTL_MS = (Number(process.env.CACHE_TTL_HOURS) || 24) * 60 * 60 * 1000;

// code -> { data, generatedAt }
const cache = new Map();
// code -> Promise (in-flight generation, dedupes concurrent requests for the same subject)
const inFlight = new Map();

function buildPrompt(subject) {
  const hasPapers = (subject.papers || []).length > 0;

  let sourceBlock;
  if (hasPapers) {
    const lines = [];
    subject.papers.forEach(p => {
      lines.push(`\n--- ${p.examType} · Slot ${p.slot} (${p.semType}) ---`);
      (p.questions || []).forEach((q, i) => {
        lines.push(`${i + 1}. [${q.marks}M${q.co && q.co !== '—' ? ', ' + q.co : ''}] ${q.q}`);
      });
    });
    sourceBlock = `Here is the full set of real exam questions collected from ${subject.papers.length} previous papers for this subject:\n${lines.join('\n')}`;
  } else {
    const seed = (subject.seedTopics || []).map(t => `- ${t.topic} (${t.frequency})`).join('\n');
    sourceBlock = `No raw question text is available for this subject. Here is a previously compiled list of topics known to be tested, with how often they recur:\n${seed}\n\nWork from this topic list only — do not invent specific question wording or numbers that aren't implied by it.`;
  }

  return `You are analyzing past exam papers for a VIT B.Tech course to help a student prepare. Subject: ${subject.name} (${subject.code}), Semester ${subject.semester}.

${sourceBlock}

Based on this, produce a JSON object with exactly two fields:

1. "topicWeightage": an array of 6-12 objects, each { "topic": string, "weight": number (0-100, how consistently this topic recurs across the available papers), "frequency": short string like "Every CAT1" or "Common in CAT2/FAT" }. Order from highest weight to lowest.

2. "predictedImportant": an array of 4-6 short strings, each a specific, actionable prediction of what's likely to be tested next, with brief reasoning grounded in the recurrence pattern you observed (e.g. "X — appears in nearly every slot, near-certain to reappear").

Respond with ONLY the raw JSON object. No markdown fences, no preamble, no commentary.`;
}

async function callClaude(prompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set on the server');
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Anthropic API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const textBlock = (data.content || []).find(b => b.type === 'text');
  if (!textBlock) throw new Error('No text content in Anthropic response');

  let raw = textBlock.text.trim();
  // Strip markdown fences if the model added them anyway
  raw = raw.replace(/^```(json)?/i, '').replace(/```$/, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error('Failed to parse AI response as JSON: ' + e.message);
  }

  if (!Array.isArray(parsed.topicWeightage) || !Array.isArray(parsed.predictedImportant)) {
    throw new Error('AI response missing expected fields');
  }

  return parsed;
}

async function generateForSubject(code) {
  const subject = getSubject(code);
  if (!subject) {
    const err = new Error('Subject not found');
    err.status = 404;
    throw err;
  }
  const prompt = buildPrompt(subject);
  const result = await callClaude(prompt);
  return result;
}

async function getAnalysis(code, { force = false } = {}) {
  const key = code.toUpperCase();
  const cached = cache.get(key);
  const isFresh = cached && Date.now() - cached.generatedAt < CACHE_TTL_MS;

  if (isFresh && !force) {
    return { ...cached, fromCache: true };
  }

  if (inFlight.has(key)) {
    return inFlight.get(key).then(data => ({ data, generatedAt: cache.get(key).generatedAt, fromCache: false }));
  }

  const promise = generateForSubject(key)
    .then(data => {
      const entry = { data, generatedAt: Date.now() };
      cache.set(key, entry);
      inFlight.delete(key);
      return data;
    })
    .catch(err => {
      inFlight.delete(key);
      throw err;
    });

  inFlight.set(key, promise);
  const data = await promise;
  return { data, generatedAt: cache.get(key).generatedAt, fromCache: false };
}

function getCacheStatus() {
  return Array.from(cache.entries()).map(([code, v]) => ({
    code,
    generatedAt: new Date(v.generatedAt).toISOString(),
    ageMinutes: Math.round((Date.now() - v.generatedAt) / 60000),
  }));
}

module.exports = { getAnalysis, getCacheStatus };
