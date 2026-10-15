// AI-powered study pack generation and Teach Echo grading, using any
// OpenAI-compatible chat API (OpenAI, OpenRouter, Zhipu/GLM, DeepSeek,
// local Ollama/LM Studio, ...). When no key is configured — or the
// provider fails — the rule-based generator in generate.js takes over,
// so the app never hard-depends on a paid service.

import { env } from '../config/env.js'
import { generateStudyPackRules } from './generate.js'

const TIMEOUT_MS = 45_000

const SYSTEM_PROMPT = `You are Echo, a study-companion engine. You turn learning material into a study pack with notes sections, flashcards and quiz questions.

Respond with ONLY a JSON object, no markdown and no commentary, in exactly this shape:
{
  "sections": [
    {
      "id": "s1",
      "title": "Section title, using the material's own headings when it has them",
      "summary": ["2-4 informative sentences"],
      "groups": [{ "title": "Key ideas", "items": ["bullet", "bullet"] }],
      "terms": [{ "term": "Term", "def": "Definition" }],
      "keyPoints": [{ "id": "k1", "label": "Short label", "match": ["keyword", "phrase"], "hint": "A sentence from the material that explains it" }]
    }
  ],
  "cards": [{ "id": "c1", "sectionId": "s1", "q": "Question", "a": "Answer" }],
  "questions": [{ "id": "q1", "sectionId": "s1", "q": "Question", "options": ["A", "B", "C", "D"], "answer": 0, "why": "Why the answer is correct" }]
}

Rules:
- 2-8 sections. Use the material's own headings as titles when it has them.
- 1-6 cards and 1-3 questions per section.
- Every question has exactly 4 options, and "answer" is the index (0-3) of the correct option.
- "match" holds the words or short phrases a student would naturally use when explaining the key point out loud.
- Only use facts from the material. Never invent content.`

const GRADE_SYSTEM_PROMPT =
  'You are Echo, a strict but encouraging study coach. Respond with only JSON.'

/** POST to any OpenAI-compatible /chat/completions endpoint. */
async function chat(messages, { jsonMode = true } = {}) {
  const body = {
    model: env.AI_MODEL,
    temperature: 0.3,
    max_tokens: 4000,
    messages,
  }
  if (jsonMode) body.response_format = { type: 'json_object' }

  const res = await fetch(`${env.AI_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.AI_API_KEY}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`AI provider responded ${res.status}: ${detail.slice(0, 200)}`)
  }
  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content
  if (typeof text !== 'string' || !text.trim()) throw new Error('AI provider returned no content')
  return text
}

/** Extract the JSON object from a completion (tolerates stray prose/fences). */
function parseJson(text) {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) throw new Error('No JSON object in the response')
  return JSON.parse(text.slice(start, end + 1))
}

const validString = (v) => typeof v === 'string' && v.trim().length > 0

// Common words that make useless key points when a section has none.
const STOP = new Set([
  'about', 'above', 'after', 'again', 'against', 'because', 'before', 'being', 'between', 'could', 'every', 'first',
  'found', 'their', 'there', 'these', 'thing', 'those', 'through', 'under', 'where', 'which', 'while', 'would',
  'other', 'using', 'used', 'this', 'that', 'with', 'from', 'into', 'when', 'they', 'them', 'then', 'than', 'your',
  'also', 'some', 'such', 'only', 'more', 'most', 'much', 'many', 'very', 'will', 'have', 'has', 'does', 'like',
  'means', 'called', 'known', 'given', 'takes', 'makes', 'used', 'based', 'work', 'works', 'thing', 'things',
])

/**
 * A section must always carry key points: Teach Echo scores explanations
 * against them. If the model omitted them, build them from the section's own
 * terms, then from its text, so nothing is ever unscorable.
 */
function ensureKeyPoints(s) {
  if (s.keyPoints.length) return s
  const points = []
  const seen = new Set()
  for (const t of s.terms) {
    const key = t.term.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    points.push({ id: `k${points.length + 1}`, label: t.term, match: [key], hint: t.def || '' })
    if (points.length >= 5) break
  }
  if (points.length < 2) {
    const text = [...s.summary, ...s.groups.flatMap((g) => g.items)].join(' ')
    const words = [...new Set(text.toLowerCase().match(/\b[a-z][a-z0-9-]{3,}\b/g) || [])]
    for (const w of words) {
      if (points.length >= 4) break
      if (STOP.has(w) || seen.has(w)) continue
      seen.add(w)
      points.push({ id: `k${points.length + 1}`, label: w, match: [w], hint: '' })
    }
  }
  return { ...s, keyPoints: points }
}

/** Keep only well-formed entries, so a sloppy completion cannot break the app. */
function sanitizePack(raw) {
  const sections = (raw?.sections || [])
    .filter((s) => s && validString(s.id) && validString(s.title))
    .map((s) => ({
      id: String(s.id),
      title: s.title.trim(),
      summary: (s.summary || []).filter(validString),
      groups: (s.groups || [])
        .filter((g) => g && validString(g.title))
        .map((g) => ({ title: g.title, items: (g.items || []).filter(validString) })),
      terms: (s.terms || [])
        .filter((t) => t && validString(t.term) && validString(t.def))
        .map((t) => ({ term: t.term, def: t.def })),
      keyPoints: (s.keyPoints || [])
        .filter((k) => k && validString(k.id) && validString(k.label))
        .map((k) => ({
          id: String(k.id),
          label: k.label,
          match: (k.match || []).filter(validString),
          hint: validString(k.hint) ? k.hint : '',
        })),
    }))
    .map(ensureKeyPoints)

  const sectionIds = new Set(sections.map((s) => s.id))

  const cards = (raw?.cards || [])
    .filter((c) => c && validString(c.id) && sectionIds.has(c.sectionId) && validString(c.q) && validString(c.a))
    .map((c) => ({ id: String(c.id), sectionId: c.sectionId, q: c.q, a: c.a }))

  const questions = (raw?.questions || [])
    .filter(
      (q) =>
        q &&
        validString(q.id) &&
        sectionIds.has(q.sectionId) &&
        validString(q.q) &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        q.options.every(validString) &&
        Number.isInteger(q.answer) &&
        q.answer >= 0 &&
        q.answer <= 3,
    )
    .map((q) => ({
      id: String(q.id),
      sectionId: q.sectionId,
      q: q.q,
      options: q.options,
      answer: q.answer,
      why: validString(q.why) ? q.why : '',
    }))

  return { sections, cards, questions }
}

function toSourceText({ text = '', sections: given } = {}) {
  if (given?.length) return given.map((s) => `## ${s.title}\n${s.lines.join('\n')}`).join('\n\n')
  return text
}

/** Split long material into context-sized chunks, on paragraph boundaries. */
function chunkSource(source, maxChars = 12000) {
  if (source.length <= maxChars) return [source]
  const blocks = source.split(/\n{2,}/)
  const chunks = []
  let cur = ''
  for (const b of blocks) {
    if (cur && cur.length + b.length + 2 > maxChars) {
      chunks.push(cur)
      cur = b
    } else {
      cur = cur ? `${cur}\n\n${b}` : b
    }
  }
  if (cur) chunks.push(cur)
  return chunks
}

/** One AI request per chunk, with a single retry (second try without json mode). */
async function packForChunk(chunk) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Turn this study material into a study pack.\n\n${chunk}` },
  ]
  for (const jsonMode of [true, false]) {
    try {
      return sanitizePack(parseJson(await chat(messages, { jsonMode })))
    } catch (err) {
      console.error(`AI generation failed (jsonMode=${jsonMode}):`, err.message)
    }
  }
  return null
}

/** Renumber ids and stitch chunk packs into one pack. */
function mergePacks(packs) {
  const sections = []
  const cards = []
  const questions = []
  const idMap = new Map()

  for (const p of packs) {
    for (const s of p.sections) {
      const nextId = `s${sections.length + 1}`
      idMap.set(s.id, nextId)
      sections.push({ ...s, id: nextId })
    }
  }
  for (const p of packs) {
    for (const c of p.cards) {
      cards.push({ ...c, id: `c${cards.length + 1}`, sectionId: idMap.get(c.sectionId) || c.sectionId })
    }
    for (const q of p.questions) {
      questions.push({ ...q, id: `q${questions.length + 1}`, sectionId: idMap.get(q.sectionId) || q.sectionId })
    }
  }
  return { sections, cards, questions }
}

/**
 * Generate a study pack. AI first (when a key is configured), with the
 * rule-based generator as a fallback so the app always works.
 */
export async function generateStudyPack(input) {
  const source = toSourceText(input)
  if (!env.AI_API_KEY || !source.trim()) return generateStudyPackRules(input)

  const chunks = chunkSource(source)
  const packs = []
  for (const chunk of chunks) {
    const pack = await packForChunk(chunk)
    if (pack && pack.sections.length) packs.push(pack)
  }
  if (!packs.length) return generateStudyPackRules(input)
  return mergePacks(packs)
}

/**
 * Grade a Teach Echo explanation against a topic's key points.
 * Returns the same shape as the local scorer, or null when AI is
 * unavailable (the caller then falls back to the local score).
 */
export async function gradeExplanation({ keyPoints, text }) {
  if (!env.AI_API_KEY || !keyPoints?.length) return null

  const list = keyPoints.map((k, i) => `${i + 1}. ${k.label}: ${k.hint}`).join('\n')
  const prompt = `Key points from the study material:
${list}

Student's explanation:
"""
${text}
"""

Which key points does the explanation actually cover, in substance (not just keywords)?
Respond with ONLY JSON: { "covered": [1, 2], "score": 0-100, "feedback": "one encouraging sentence" }.
"covered" lists the numbers of the covered key points. "score" is the percentage of key points covered, rounded.`

  try {
    const raw = parseJson(
      await chat([
        { role: 'system', content: GRADE_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ]),
    )
    const coveredIdx = (raw.covered || []).filter((n) => Number.isInteger(n) && n >= 1 && n <= keyPoints.length)
    const covered = coveredIdx.map((i) => keyPoints[i - 1])
    const missed = keyPoints.filter((k) => !covered.includes(k))
    const score =
      typeof raw.score === 'number'
        ? Math.max(0, Math.min(100, Math.round(raw.score)))
        : Math.round((covered.length / keyPoints.length) * 100)
    return {
      score,
      covered,
      missed,
      wordCount: text.trim() ? text.trim().split(/\s+/).length : 0,
      feedback: typeof raw.feedback === 'string' ? raw.feedback.slice(0, 300) : '',
    }
  } catch (err) {
    console.error('AI grading failed:', err.message)
    return null
  }
}
