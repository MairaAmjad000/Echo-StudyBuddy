// Whiteboard Teacher: turns a question (typed, or photographed) into a
// step-by-step lesson that the client writes on a whiteboard and reads out.
//
// Same Gemini key and endpoint as the rest of the app, so one AI_API_KEY powers
// notes, chat, podcasts and the whiteboard. The reply is a small, strictly
// shaped JSON document: steps, the lines to write on the board, and the spoken
// narration for each one. Nothing about the layout is left to the model — the
// client only draws what it is given.
//
// A photo is sent to Gemini as inline image data (vision), which is why the
// feature needs no paid OCR service. Images are compressed in the browser
// before they get here; the schema caps what the server accepts.

import { env } from '../config/env.js'

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta'
// Kept under the 60s function ceiling in server/vercel.json: a longer wait would
// be killed by the platform before the route could answer 504. The budget covers
// the whole call including the one retry, which gets whatever time is left.
const BUDGET_MS = 52_000
const RETRY_MIN_MS = 12_000
// Notes pasted as context are capped: a whiteboard answer needs the relevant
// part of a material, not the whole document.
const MAX_CONTEXT_CHARS = 40_000
const MAX_OUTPUT_TOKENS = 6144

/** True when a Google AI Studio key is configured. */
export const whiteboardAvailable = () => !!env.AI_API_KEY

const PROMPT = `You are Echo, a patient teacher standing at a whiteboard. A student has brought you a question. Teach the solution from the first line to the final answer, exactly as you would write it on the board.

Respond with ONLY a JSON object — no markdown fence, no commentary — in this shape:
{
  "title": "Short lesson title, e.g. 'Solve 2x + 3 = 11'",
  "subject": "One word or short phrase: Algebra, Geometry, Calculus, Physics, Chemistry, Biology, History, ...",
  "summary": "One sentence naming the idea the lesson teaches.",
  "steps": [
    {
      "title": "Short name for this step, e.g. 'Isolate the x term'",
      "say": "What the teacher says out loud while writing this step. One or two plain-English sentences, no symbols read as code.",
      "lines": [
        { "kind": "text", "text": "A short sentence written on the board." },
        { "kind": "math", "text": "2x + 3 - 3 = 11 - 3" },
        { "kind": "note", "text": "A tip or rule worth remembering." }
      ]
    }
  ],
  "answer": { "text": "x = 4", "say": "One spoken sentence stating and interpreting the answer." }
}

Rules:
- 3 to 7 steps. Each step teaches one idea and builds on the previous one. Show every important manipulation; never skip straight to the result.
- "lines" is what the student sees being written. Keep each line short enough for a wide board. At most 4 lines per step.
- "kind": "math" holds LaTeX WITHOUT delimiters (write x^2, \\frac{1}{2}, \\sqrt{9}, \\Delta) and is rendered as an equation. Use it only for actual mathematics.
- "kind": "text" is plain writing. "kind": "note" is a highlighted tip or rule. For a non-mathematical question use "text" and "note" only.
- "say" is narration, not a transcript of the board: explain why the step works in words a student can follow while reading. 1-2 sentences.
- The "answer" field is required. If the question has no single numeric answer, state the conclusion in one line.
- Work only from the question and any notes supplied. If the question is incomplete, state a reasonable assumption in the first step rather than refusing.
- Plain English. No markdown, no emoji, no headings inside the strings.`

/** Strip the math delimiters a model sometimes adds, since the client renders raw LaTeX. */
function stripTex(value) {
  return String(value || '')
    .trim()
    .replace(/^\$\$?|\$\$?$/g, '')
    .replace(/^\\\(|\\\)$/g, '')
    .replace(/^\\\[|\\\]$/g, '')
    .trim()
}

const LIMITS = { title: 120, subject: 48, summary: 320, stepTitle: 110, say: 700, line: 400 }
const KINDS = new Set(['text', 'math', 'note'])

/**
 * Keep only a lesson the client can draw: between 1 and 8 steps, each with at
 * least one line, short strings, a known line kind, and an answer. A sloppy
 * completion can never crash the board.
 */
function sanitizeLesson(raw) {
  const clip = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

  const steps = (Array.isArray(raw?.steps) ? raw.steps : [])
    .slice(0, 8)
    .map((s) => {
      const lines = (Array.isArray(s?.lines) ? s.lines : [])
        .slice(0, 5)
        .map((l) => {
          const kind = KINDS.has(l?.kind) ? l.kind : 'text'
          const text = (kind === 'math' ? stripTex(l?.text) : clip(l?.text, LIMITS.line)).slice(0, LIMITS.line)
          return { kind, text }
        })
        .filter((l) => l.text)
      return {
        title: clip(s?.title, LIMITS.stepTitle),
        say: clip(s?.say, LIMITS.say),
        lines,
      }
    })
    .filter((s) => s.lines.length)
    .map((s, i) => ({ ...s, title: s.title || `Step ${i + 1}` }))

  if (!steps.length) throw new Error('Model returned no usable steps')

  const lastMath = [...steps[steps.length - 1].lines].reverse().find((l) => l.kind === 'math')
  const answerText = stripTex(raw?.answer?.text) || lastMath?.text || steps[steps.length - 1].lines.slice(-1)[0]?.text || ''
  const answer = {
    text: answerText.slice(0, LIMITS.line),
    say: clip(raw?.answer?.say, LIMITS.say),
  }

  return {
    title: clip(raw?.title, LIMITS.title) || 'Whiteboard lesson',
    subject: clip(raw?.subject, LIMITS.subject) || 'Study',
    summary: clip(raw?.summary, LIMITS.summary),
    steps,
    answer,
  }
}

/** Mark a failed API call so the controller can explain quota instead of "something went wrong". */
function apiError(status, detail) {
  const err = new Error(`Gemini API ${status}: ${detail.slice(0, 200)}`)
  err.status = status
  err.quota = status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(detail)
  return err
}

/** Parse the data URL the browser sends into the inline image shape Gemini wants. */
function inlineImage(dataUrl) {
  const match = /^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl)
  if (!match) return null
  return { mimeType: match[1].replace('jpg', 'jpeg'), data: match[2].replace(/\s/g, '') }
}

/**
 * Build one lesson. `question` may be empty when `image` is supplied; `context`
 * is optional study material the answer should be grounded in.
 */
export async function generateLesson({ question = '', image = '', context = '', subject = '' }, attempt = 0, deadline = Date.now() + BUDGET_MS) {
  const photo = image ? inlineImage(image) : null
  if (!question.trim() && !photo) throw new Error('Nothing to teach: no question and no readable image')

  const parts = []
  const framing = [
    subject ? `Subject: ${subject}.` : '',
    context ? `The student's own notes are supplied below. Ground the lesson in them where they are relevant, and say plainly if they do not cover the question.\n\nNOTES:\n"""\n${context.slice(0, MAX_CONTEXT_CHARS)}\n"""` : '',
    question.trim() ? `The student's question:\n"""\n${question.trim()}\n"""` : 'The student photographed a question. Read it from the image and solve it.',
    photo ? 'The image below is the question. Read all of it carefully, including labels, units and answer choices if present.' : '',
    'Teach it on the whiteboard now. Remember: JSON only.',
  ].filter(Boolean)
  parts.push({ text: `${PROMPT}\n\n${framing.join('\n\n')}` })
  if (photo) parts.push({ inline_data: { mime_type: photo.mimeType, data: photo.data } })

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: 0.35,
      responseMimeType: 'application/json',
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      // 2.5 Flash otherwise spends output tokens on hidden reasoning and can
      // truncate the JSON mid-document, leaving nothing to draw.
      thinkingConfig: { thinkingBudget: 0 },
    },
  }

  const res = await fetch(`${API_ROOT}/models/${env.AI_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.AI_API_KEY },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(Math.max(1_000, Math.min(BUDGET_MS, deadline - Date.now()))),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    // A free-tier minute limit clears quickly: back off once before giving up.
    // The retry shares the original budget, so a slow first attempt cannot turn
    // into a request the host kills before the route can answer.
    if ((res.status === 429 || res.status >= 500) && attempt < 1 && deadline - Date.now() > RETRY_MIN_MS) {
      await new Promise((r) => setTimeout(r, 2500))
      return generateLesson({ question, image, context, subject }, attempt + 1, deadline)
    }
    throw apiError(res.status, detail)
  }

  const data = await res.json()
  const candidate = data.candidates?.[0]
  const text = (candidate?.content?.parts || [])
    .map((p) => p.text || '')
    .join('')
    .trim()
  if (!text) {
    throw new Error(`Gemini returned no lesson (${candidate?.finishReason || data.promptFeedback?.blockReason || 'empty'})`)
  }

  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('No JSON object in the lesson response')

  let parsed
  try {
    parsed = JSON.parse(text.slice(start, end + 1))
  } catch {
    throw new Error('Gemini returned malformed JSON for this question')
  }
  return sanitizeLesson(parsed)
}
