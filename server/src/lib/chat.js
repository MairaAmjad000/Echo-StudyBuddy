// Chat with Echo: a Gemini conversation grounded in ONE study material.
//
// The material's own words are placed in the system instruction, so the model
// answers from the student's file instead of from general knowledge. Gemini is
// reached through Google AI Studio (same key and model as study-pack
// generation), so a single AI_API_KEY powers both features.

import { env } from '../config/env.js'

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta'
const TIMEOUT_MS = 45_000
// Keep the prompt, the material and the history inside a comfortable budget.
const MAX_CONTEXT_CHARS = 24_000
const MAX_HISTORY = 12
const MAX_REPLY_TOKENS = 1024

/** True when a Google AI Studio key is configured. */
export const chatAvailable = () => !!env.AI_API_KEY

/**
 * The material as plain reference text: the original file text when we kept
 * it, otherwise the generated notes (headings, summaries, bullets, terms).
 */
export function materialContext(material) {
  const source = typeof material?.sourceText === 'string' ? material.sourceText.trim() : ''
  if (source) return source.slice(0, MAX_CONTEXT_CHARS)

  const sections = material?.pack?.sections || []
  const parts = sections.map((s, i) => {
    const lines = [`## ${i + 1}. ${s.title}`]
    for (const p of s.summary || []) lines.push(p)
    for (const g of s.groups || []) {
      if (g.title) lines.push(`${g.title}:`)
      for (const item of g.items || []) lines.push(`- ${item}`)
    }
    for (const t of s.terms || []) lines.push(`- ${t.term}: ${t.def}`)
    return lines.join('\n')
  })
  return parts.join('\n\n').slice(0, MAX_CONTEXT_CHARS)
}

const RULES = `You are Echo, a warm and precise study companion. You are chatting with a student about ONE piece of study material, quoted below.

How to answer:
- Answer from the material only. It is the source of truth for this conversation.
- If the material does not cover what was asked, say so plainly in one sentence and offer what it does cover. Never invent facts, numbers or names.
- Be brief and spoken: 2 to 5 short sentences, or a short list when the question asks for steps or a comparison.
- Quote the material's wording for definitions and key terms.
- Stay encouraging and concrete. Use plain English, no markdown headings, no long preambles.
- If the student asks you to quiz them, ask one question at a time and wait for their answer before explaining.
- If asked something unrelated to studying (small talk, coding, news), answer in one friendly sentence and steer back to the material.`

/**
 * Ask Echo a question about a material. `messages` is the conversation so far,
 * oldest first, as `{ role: 'user' | 'echo', content }`.
 */
export async function askEcho({ material, messages }) {
  const context = materialContext(material)
  if (!context) throw new Error('Material has no readable text to ground the answer')

  const contents = messages
    .slice(-MAX_HISTORY)
    .filter((m) => m?.content)
    .map((m) => ({
      role: m.role === 'echo' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

  const system = `${RULES}\n\nThe material is titled "${material.title}".\n\nMATERIAL:\n"""\n${context}\n"""`

  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig: {
      temperature: 0.6,
      maxOutputTokens: MAX_REPLY_TOKENS,
      // 2.5 Flash spends output tokens on hidden "thinking" by default; chat
      // answers must stay short and cheap, so switch it off.
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
    // Quota and rate limits are the caller's problem to explain, not a bug:
    // mark them so the route can answer 429 instead of "something went wrong".
    const err = new Error(`Gemini API ${res.status}: ${detail.slice(0, 200)}`)
    err.status = res.status
    err.quota = res.status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(detail)
    throw err
  }

  const data = await res.json()
  const candidate = data.candidates?.[0]
  const reply = (candidate?.content?.parts || [])
    .map((p) => p.text || '')
    .join('')
    .trim()
  if (!reply) throw new Error(`Gemini returned no answer (${candidate?.finishReason || data.promptFeedback?.blockReason || 'empty'})`)
  return reply.slice(0, 4000)
}
