// Gemini client for study-pack generation, using a Google AI Studio API key
// (the newer "AQ." auth keys included — they work on the standard
// generativelanguage.googleapis.com endpoint via the x-goog-api-key header).
//
// A material is often far longer than one model reply can carry, so it is cut
// into chunks and read end to end: every chunk gets its own call, the partial
// packs are merged, and nothing past the opening pages is quietly dropped. The
// prompt asks for as many notes, cards and questions as the text supports, and
// the merge spreads the caps across chunks instead of truncating the tail — a
// long PDF must not lose its last chapters.
//
// The JSON shape matches the rule-based generator in generate.js exactly, so the
// rest of the app (notes, flashcards, quiz, Teach Echo) never changes. On any
// failure the caller falls back to the rule-based pack.

import { env } from '../config/env.js'

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta'
const TIMEOUT_MS = 60_000

/** How much text one model call reads. */
const CHUNK_CHARS = 24_000
/** Beyond this the request body cap (200k chars of source text) is unreachable anyway. */
const MAX_CHUNKS = 10
/**
 * Calls in flight at once. Two is deliberate: a long document is several calls
 * in a row, and the free tier answers a burst of three with 429s. Together with
 * the retry below, two keeps a whole-document read inside the rate limit.
 */
const CONCURRENCY = 2
/** Stop starting new chunks after this; keep what came back. */
const OVERALL_BUDGET_MS = 240_000

/** Ceilings for a merged pack, matched by the request schema. */
const MAX_SECTIONS = 60
const MAX_CARDS = 400
const MAX_QUESTIONS = 300

/** True when a Google AI Studio key is configured. */
export const aiAvailable = () => !!env.AI_API_KEY

const PROMPT = `You are Echo, a study-notes generator. From the STUDY TEXT below, produce strictly a JSON object (no markdown fence, no commentary) with three keys:

"sections": array of topic objects, each:
  { "title": "<topic title>", "summary": ["<2-4 plain sentences rewriting the content clearly>"], "groups": [[\"<bullet point as written or rephrased>\"]], "terms": [{\"term\": \"<term>\", \"def\": \"<definition>\"}] }
  ("groups" is an array of bullet-groups; an empty array is fine when there are no bullets.)
"cards": array of flashcards: { "sectionIndex": <0-based index into "sections">, "q": "<question>", "a": "<answer>" } built from the definitions and key facts.
"questions": array of multiple-choice quiz questions about the text, each:
  { "sectionIndex": <0-based index into "sections">, "q": "<question text>", "options": ["<option A>", "<option B>", "<option C>", "<option D>"], "answer": <0-based index of the correct option in "options">, "why": "<one sentence explanation quoting the text>" }
  Exactly one correct option. Distractors must be plausible but clearly wrong.

Coverage is the point of this job:
- Cover the WHOLE study text from its first sentence to its last. Later paragraphs matter as much as the first ones; never summarise the material away or skip a region of it.
- Split it into as many distinct topics as it really has (4 to 10). Do not merge separate topics into one, and do not invent topics it does not contain.
- Write a flashcard for every definition, term, number, name, step and distinction you can find: aim for 20 to 30, at least two per topic, and never fewer than 10 for a long text. A longer text must yield more cards than a short one.
- Write a quiz question for every key fact you can test, again 20 to 30, at least one per topic and never fewer than 10 for a long text.
- Mine every distinct paragraph of the text for a card or a question. Do not stop early after covering only the opening pages.
- Only if the text is genuinely short or thin, return fewer rather than padding with invented facts.

Rules: base everything ONLY on the study text. Use plain English. No extra keys, no ids.

STUDY TEXT:
"""`

/**
 * Cut text into model-sized chunks, preferring to break at a paragraph or a
 * sentence end so no idea is split in half.
 */
export function chunkText(text, size = CHUNK_CHARS, max = MAX_CHUNKS) {
  const clean = String(text || '').replace(/\r/g, '').trim()
  if (clean.length <= size) return clean ? [clean] : []

  const chunks = []
  let at = 0
  while (at < clean.length && chunks.length < max) {
    let end = Math.min(clean.length, at + size)
    if (end < clean.length) {
      const window = clean.slice(at, end)
      const cut = Math.max(window.lastIndexOf('\n\n'), window.lastIndexOf('. '), window.lastIndexOf('! '), window.lastIndexOf('? '))
      // Only honour a break that is reasonably close to the end of the window,
      // otherwise stay at the hard limit rather than making a tiny chunk.
      if (cut > size * 0.55) end = at + cut + 2
    }
    const chunk = clean.slice(at, end).trim()
    if (chunk) chunks.push(chunk)
    at = end
  }
  // A sliver left at the end is not worth a call of its own; fold it into the
  // chunk before it (the text is already past the per-call budget there).
  const last = chunks[chunks.length - 1]
  if (chunks.length > 1 && last && last.length < size / 4) {
    chunks.splice(chunks.length - 2, 2, `${chunks[chunks.length - 2]}\n${last}`)
  }
  return chunks
}

/** Extract the first JSON object from a model response (it may add fences or prose). */
function parseJson(text) {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('No JSON object in model response')
  return JSON.parse(text.slice(start, end + 1))
}

/**
 * One chunk's reply, normalised and numbered from s1/c1/q1. `cards` and
 * `questions` keep a sectionId pointing at this partial's own sections; the
 * merge re-maps it.
 */
function normalizePack(raw) {
  if (!raw || !Array.isArray(raw.sections) || raw.sections.length === 0) throw new Error('Model pack has no sections')
  const sections = raw.sections.slice(0, 12).map((s, i) => ({
    id: `s${i + 1}`,
    title: String(s.title || `Part ${i + 1}`).slice(0, 80),
    summary: (s.summary || []).map(String).slice(0, 5),
    groups: (s.groups || []).map((g) => ({ items: (Array.isArray(g) ? g : []).map(String).slice(0, 14) })),
    terms: (s.terms || []).slice(0, 12).map((t) => ({ term: String(t.term || '').slice(0, 60), def: String(t.def || '') })),
    keyPoints: [],
  }))

  // Cards and questions need a sectionId the client filters on. Ask the model
  // for a sectionIndex when present; otherwise spread them across sections.
  const numberToId = (n) => sections[Math.min(sections.length - 1, Math.max(0, Number(n)))]?.id || sections[0].id

  const cards = (raw.cards || []).slice(0, 60).map((c, i) => ({
    id: `c${i + 1}`,
    sectionId: c.sectionIndex != null ? numberToId(c.sectionIndex) : numberToId(Math.floor((i * sections.length) / Math.max(1, raw.cards.length || 1))),
    q: String(c.q || '').slice(0, 240),
    a: String(c.a || '').slice(0, 320),
  })).filter((c) => c.q && c.a)

  const questions = (raw.questions || [])
    .filter((q) => Array.isArray(q.options) && q.options.length >= 2 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length)
    .slice(0, 60)
    .map((q, i) => {
      const options = q.options.slice(0, 4).map(String)
      const answer = Math.min(q.answer, options.length - 1)
      return {
        id: `q${i + 1}`,
        sectionId: q.sectionIndex != null ? numberToId(q.sectionIndex) : sections[Math.min(sections.length - 1, Math.floor((i * sections.length) / Math.max(1, raw.questions.length || 1)))]?.id || sections[0].id,
        q: String(q.q || '').slice(0, 400),
        options,
        answer,
        why: String(q.why || '').slice(0, 400),
      }
    })

  return { sections, cards, questions }
}

/**
 * Keep at most `cap` items while still drawing from every bucket, so a cap
 * shortens each part of the material instead of deleting the last parts of it.
 * The original order is restored afterwards.
 */
function spread(groups, cap) {
  const lists = groups.filter((g) => g.length)
  const total = lists.reduce((n, g) => n + g.length, 0)
  if (total <= cap) return lists.flat()
  const kept = []
  for (let round = 0; kept.length < cap; round++) {
    let added = false
    for (const list of lists) {
      if (round < list.length && kept.length < cap) {
        kept.push(list[round])
        added = true
      }
    }
    if (!added) break
  }
  return kept
}

function groupByChunk(list) {
  const groups = new Map()
  list.forEach((x) => {
    const key = x.chunkIndex ?? 0
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(x)
  })
  return [...groups.values()]
}

/** Sections keep their chunk's share, so the end of a long document survives the cap. */
function trimSections(sections, cap) {
  const kept = (sections.length <= cap ? sections : spread(groupByChunk(sections), cap))
    .slice()
    .sort((a, b) => a.order - b.order)
  const idMap = new Map()
  const out = kept.map((s, i) => {
    const id = `s${i + 1}`
    idMap.set(s.id, id)
    return { ...s, id }
  })
  return { sections: out, idMap }
}

/** Merge the per-chunk packs into one, renumbering everything and re-mapping section ids. */
function mergePacks(partials) {
  const sections = []
  const cards = []
  const questions = []

  partials.forEach((part, chunkIndex) => {
    const remap = new Map()
    part.sections.forEach((s) => {
      const id = `s${sections.length + 1}`
      remap.set(s.id, id)
      sections.push({ ...s, id, chunkIndex, order: sections.length + 1 })
    })
    const here = (x) => ({ ...x, sectionId: remap.get(x.sectionId) || sections[0]?.id, chunkIndex })
    part.cards.forEach((c) => cards.push({ ...here(c), order: cards.length + 1 }))
    part.questions.forEach((q) => questions.push({ ...here(q), order: questions.length + 1 }))
  })

  // Trim each list to its ceiling, then renumber so the ids stay gapless.
  const { sections: keptSections, idMap } = trimSections(sections, MAX_SECTIONS)
  const home = (x) => idMap.get(x.sectionId) || keptSections[0]?.id
  const keep = (list, cap) => (list.length <= cap ? list : spread(groupByChunk(list), cap)).slice().sort((a, b) => a.order - b.order)
  const keptCards = keep(cards, MAX_CARDS).map((c, i) => ({ ...c, id: `c${i + 1}`, sectionId: home(c) }))
  const keptQuestions = keep(questions, MAX_QUESTIONS).map((q, i) => ({ ...q, id: `q${i + 1}`, sectionId: home(q) }))

  return {
    sections: keptSections.map(({ chunkIndex, order, ...s }) => s),
    cards: keptCards.map(({ chunkIndex, order, ...c }) => c),
    questions: keptQuestions.map(({ chunkIndex, order, ...q }) => q),
  }
}

async function callModel(text, attempt = 0) {
  const body = {
    contents: [{ parts: [{ text: PROMPT + text + '\n"""' }] }],
    // Disable the model's hidden “thinking” tokens (2.5 Flash): they eat into
    // maxOutputTokens and once truncated the JSON becomes unparseable, with a
    // large output budget so a full pack always fits.
    generationConfig: {
      temperature: 0.4,
      responseMimeType: 'application/json',
      maxOutputTokens: 16_384,
      thinkingConfig: { thinkingBudget: 0 },
    },
  }
  const res = await fetch(`${API_ROOT}/models/${env.AI_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.AI_API_KEY },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    // Rate limits and server hiccups are worth waiting out: a per-minute limit
    // clears after a short pause, so back off 2s then 8s before giving up on a
    // chunk (giving up only costs that chunk's notes, never the whole pack).
    if ((res.status === 429 || res.status >= 500) && attempt < 2) {
      await new Promise((r) => setTimeout(r, attempt === 0 ? 2000 : 8000))
      return callModel(text, attempt + 1)
    }
    throw new Error(`Gemini API ${res.status}: ${detail.slice(0, 200)}`)
  }
  const data = await res.json()
  const candidate = data.candidates?.[0]
  const joined = (candidate?.content?.parts || [])
    .map((p) => p.text || '')
    .join('')
    .trim()
  if (candidate?.finishReason === 'MAX_TOKENS') {
    throw new Error('Gemini output was cut off before the JSON was complete')
  }
  if (!joined) throw new Error('Empty response from Gemini')
  let parsed
  try {
    parsed = parseJson(joined)
  } catch {
    throw new Error('Gemini returned malformed JSON for this material')
  }
  return normalizePack(parsed)
}

/**
 * Read the whole material: one call per chunk, merged into a single pack. Chunks
 * that fail are skipped as long as something usable came back, so one bad call
 * never costs the student their notes; if every call fails the caller falls back
 * to the rule-based generator.
 */
export async function generateStudyPackWithAi(text) {
  const chunks = chunkText(text)
  if (!chunks.length) throw new Error('Nothing to send to Gemini')

  const results = new Array(chunks.length).fill(null)
  const started = Date.now()
  let next = 0

  const worker = async () => {
    for (;;) {
      const index = next++
      if (index >= chunks.length) return
      if (Date.now() - started > OVERALL_BUDGET_MS && index > 0) return
      try {
        results[index] = await callModel(chunks[index])
      } catch (err) {
        // Keep the reason for the log; the merge only needs the successes.
        console.warn(`Study pack chunk ${index + 1}/${chunks.length} failed: ${err.message}`)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, worker))

  const done = results.filter(Boolean)
  if (!done.length) throw new Error('Gemini produced no usable pack for this material')

  const pack = mergePacks(done)
  if (!pack.sections.length || !pack.cards.length || !pack.questions.length) {
    throw new Error('Merged model pack is incomplete')
  }
  return pack
}
