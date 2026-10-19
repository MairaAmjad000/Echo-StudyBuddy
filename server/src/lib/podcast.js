// The script for "Study Session", the two-host podcast an episode is recorded
// from.
//
// Two writers produce the same shape — { title, segments: [{ speaker, text }] }
// with speakers 'echo' and 'milo' — so the rest of the feature never has to
// know which one ran:
//
//   * writePodcastWithAi()   — Gemini reads the whole material and writes a real
//     conversation about it. This is the good one.
//   * buildPodcastFromPack() — the no-key fallback, assembled from the notes,
//     flashcards and quiz questions that already exist for the material. It
//     never invents anything: every line is one of those parts, said out loud.
//
// Both paths end in normalizeScript(), which is what keeps the audio listenable:
// turns are spoken-language length, the two hosts stay interleaved, and anything
// the material made unreadable (markdown, arrows, citations, half-sentence
// "terms" from a slide split) is cleaned off or left out.

import { env } from '../config/env.js'
import { fullText } from './chat.js'
import { capitalize } from './format.js'

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta'
// Under the 60s function ceiling in server/vercel.json, with room left for the
// built-in writer when the model is too slow to answer.
const TIMEOUT_MS = 50_000

/** How much of a material the script writer reads. Long enough for a full
 * chapter, short enough that the model still has room to write the episode. */
const MAX_CONTEXT_CHARS = 120_000

/** One spoken line. Long lines are the main thing that makes synthetic speech
 * sound like a document instead of a conversation. */
const MAX_LINE_CHARS = 520

/** Hard ceiling on an episode, whatever a writer returns. */
export const MAX_SEGMENTS = 96

/** The two hosts, in the order they appear in a script. */
export const SPEAKER_IDS = ['echo', 'milo']

/**
 * The three episode lengths. `words` is the spoken budget and `sections` how
 * much of a long course the episode reaches; the built-in writer fills the
 * budget from whatever the material actually holds, and the model is asked for
 * the same total in words. The real duration is measured from the finished
 * script, so the label never promises minutes the material cannot carry.
 */
export const PODCAST_LENGTHS = [
  { id: 'short', label: 'Short — highlights', words: 800, sections: 5, prose: 2 },
  { id: 'standard', label: 'Standard — whole course', words: 1450, sections: 10, prose: 3 },
  { id: 'deep', label: 'Deep dive — every topic', words: 2300, sections: 18, prose: 3 },
]

export const DEFAULT_LENGTH = 'standard'

export const lengthById = (id) => PODCAST_LENGTHS.find((l) => l.id === id) || PODCAST_LENGTHS[1]

/** Roughly 155 spoken words a minute, plus the breath between turns. */
export const estimateSeconds = (text) => Math.round(wordsOf(text) / 2.6 + 0.6)

export const wordsOf = (text) => String(text || '').split(/\s+/).filter(Boolean).length

export const minutesFor = (seconds) => Math.max(1, Math.round(seconds / 60))

/** True when a Google AI Studio key is configured. */
export const podcastAiAvailable = () => !!env.AI_API_KEY

/**
 * Turn a line of notes into a line somebody can say: no markdown marks, no
 * "Figure 2:" labels, no run of spaces, and never longer than one breath.
 */
export function cleanLine(text) {
  let out = String(text ?? '')
    .replace(/\r/g, ' ')
    .replace(/[*_`#>|]+/g, ' ')
    .replace(/^\s*(?:[-•*▪◦·–—]|\d+[.)])\s+/, '')
    .replace(/^(?:fig(?:ure)?|table|chart|diagram|image|exhibit)\.?\s*\d+[a-z]?\s*[:.-]?\s*/i, '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s*[\u2013\u2014\u2212]\s*/g, ' to ')
    .replace(/\s*\|\s*/g, ', ')
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .replace(/[•◦▪·→←↔⇒]/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()

  if (out.length > MAX_LINE_CHARS) {
    const cut = out.slice(0, MAX_LINE_CHARS)
    const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '))
    out = stop > MAX_LINE_CHARS * 0.45 ? cut.slice(0, stop + 1) : `${cut.replace(/\s+\S*$/, '')}.`
  }
  return out
}

/** A sentence from the notes, ready to be read as speech. */
const sentence = (text) => {
  const clean = cleanLine(text)
  if (!clean) return ''
  return /[.!?]$/.test(clean) ? clean : `${clean}.`
}

/** The first `count` usable sentences of a list, joined for one turn. */
const sentences = (list, count) =>
  (list || [])
    .map(sentence)
    .filter((s) => s.length > 24)
    .slice(0, count)
    .join(' ')

/** A definition as a spoken line: "Bandwidth: the amount of data ...". */
function termLine(term, def) {
  const name = cleanLine(term)
  const meaning = cleanLine(def).replace(/\.$/, '')
  if (!name || !meaning) return ''
  return sentence(`${name}: ${meaning}`)
}

/** A list read the way a person would say it out loud. */
function listLine(items, max = 4) {
  const chosen = (items || []).map(cleanLine).filter((s) => s.length > 2).slice(0, max)
  if (!chosen.length) return ''
  if (chosen.length === 1) return chosen[0]
  return `${chosen.slice(0, -1).join(', ')} and ${chosen[chosen.length - 1]}`
}

/* ------------------------------------------------------------------ *
 * What counts as material worth saying out loud
 * ------------------------------------------------------------------ */

/**
 * The notes come from heuristics reading a document, so some "terms" are really
 * half a clause ("When loss", from "When loss is detected the window is cut").
 * A question made of that sounds broken, so those are left out entirely.
 */
const BAD_TERM_START =
  /^(?:the|a|an|when|where|if|how|why|then|that|this|these|those|it|there|so|now|also|and|or|but|because|while|after|before|since|once|both|either|neither|each|every|some|any|most|many|few|more|less|first|second|third|next|last|finally|however|therefore|instead|otherwise|in|on|at|for|with|from|by|to|of|as|is|are|was|were|be|being|been)\b/i

export const usableTerm = (term) => {
  const t = cleanLine(term)
  return t.length >= 3 && t.length <= 48 && !BAD_TERM_START.test(t) && !/\b(?:is|are|was|were|means|refers)\b/i.test(t) && !/^\d+$/.test(t)
}

/**
 * Questions stay usable for audio when their wording survives being read aloud:
 * a "fill in the blank" question does not ("Fill in the blank: is the maximum
 * amount of data a link can carry"), so those are skipped.
 */
export const usableQuestion = (question) =>
  Boolean(question?.q) && !/^\s*fill in the blank/i.test(question.q) && wordsOf(question.q) <= 42

/** A phrase that only makes sense on the page it was cut from ("detected the
 * window is cut", "When loss") sounds broken read out as an answer option. */
const CLAUSE_START =
  /^(?:when|where|if|how|why|then|that|this|these|those|it|there|so|now|also|and|or|but|because|while|after|before|since|once|both|either|neither|each|every|some|any|most|many|few|more|less|first|second|third|next|last|finally|however|therefore|instead|otherwise|is|are|was|were|detected|take|give|put|get)\b/i

/** Long option lists read as homework, so only short, clean ones are spoken. */
const speakableOptions = (options) => {
  const list = (options || []).map(cleanLine).filter(Boolean)
  const tidy = list.length >= 2 && list.length <= 4 && list.every((o) => wordsOf(o) <= 6 && !CLAUSE_START.test(o))
  return tidy ? list : []
}

/* ------------------------------------------------------------------ *
 * Assembly helpers
 * ------------------------------------------------------------------ */

/**
 * Sections spread evenly across the material rather than taken from the top, so
 * a five-topic episode of a twenty-topic course still reaches its last topic.
 */
function pickSections(sections, count) {
  if (sections.length <= count) return sections
  const step = sections.length / count
  const out = []
  for (let i = 0; i < count; i++) out.push(sections[Math.min(sections.length - 1, Math.floor(i * step))])
  return out
}

const cleanTitle = (raw, fallback) => {
  const title = cleanLine(raw).replace(/^["']|["']$/g, '').replace(/\.$/, '')
  return (title || fallback).slice(0, 120)
}

/**
 * Hold a script to its word budget by thinning the middle, never the opening or
 * the sign-off: the first turns set the episode up and the last ones leave the
 * student with something to do.
 *
 * Turns are dropped in adjacent pairs and spread through the material, because
 * a conversation cannot lose one half of a question-and-answer without the
 * other half left dangling next to it.
 */
function trimToBudget(segments, maxWords) {
  const total = segments.reduce((n, s) => n + wordsOf(s.text), 0)
  if (total <= maxWords || segments.length <= 12) return segments

  const head = segments.slice(0, 4)
  const tail = segments.slice(-5)
  const middle = segments.slice(4, segments.length - 5)
  const allowance = maxWords - [...head, ...tail].reduce((n, s) => n + wordsOf(s.text), 0)
  const middleWords = middle.reduce((n, s) => n + wordsOf(s.text), 0)
  if (allowance <= 0 || middleWords <= allowance) return segments

  const average = middleWords / middle.length
  let pairCount = Math.ceil((middleWords - allowance) / average / 2)
  // Each block has to keep at least one turn, and removals come in pairs.
  pairCount = Math.max(0, Math.min(pairCount, Math.floor(middle.length / 6)))
  if (!pairCount) return segments

  const size = Math.floor(middle.length / pairCount)
  const kept = []
  for (let i = 0; i < middle.length; i += size) {
    const block = middle.slice(i, i + size)
    kept.push(...(block.length > 3 ? block.slice(2) : block))
  }
  return [...head, ...kept, ...tail]
}

/**
 * The last gate before the audio: drop unusable turns, merge a run of three or
 * more turns from the same host into one, number the segments, and hold the
 * whole script to the episode's word budget.
 */
function normalizeScript(raw, length) {
  const cleaned = []
  for (const item of raw || []) {
    const speaker = item?.speaker === 'milo' ? 'milo' : item?.speaker === 'echo' ? 'echo' : null
    const text = cleanLine(item?.text)
    if (!speaker || text.length < 3) continue
    const previous = cleaned[cleaned.length - 1]
    if (previous && previous.speaker === speaker && previous.text === text) continue
    cleaned.push({ speaker, text })
  }

  const merged = []
  for (const turn of trimToBudget(cleaned, length.words)) {
    const previous = merged[merged.length - 1]
    const before = merged[merged.length - 2]
    // A host who speaks three times in a row is writing prose, not a
    // conversation. Fold the third turn into the second.
    if (previous && before && previous.speaker === turn.speaker && before.speaker === turn.speaker) {
      const joined = `${previous.text} ${turn.text}`
      if (joined.length <= MAX_LINE_CHARS) {
        previous.text = joined
        continue
      }
    }
    merged.push({ ...turn })
  }

  return merged.slice(0, MAX_SEGMENTS).map((s, i) => ({
    id: `t${i + 1}`,
    speaker: s.speaker,
    text: s.text,
    seconds: estimateSeconds(s.text),
  }))
}

/** The episode as the routes and the player see it. */
export function episodeFromScript({ title, segments, length, source, material }) {
  const seconds = segments.reduce((n, s) => n + (s.seconds || estimateSeconds(s.text)), 0)
  return {
    title: cleanTitle(title, material?.title || 'Study Session'),
    length,
    source,
    segments,
    seconds,
    words: segments.reduce((n, s) => n + wordsOf(s.text), 0),
  }
}

/* ------------------------------------------------------------------ *
 * The built-in writer
 * ------------------------------------------------------------------ */

// Milo's question shapes, used in order so one episode never repeats itself.
const ASK_TERM = [
  (term) => `Okay, hold on. What does ${term} actually mean?`,
  (term) => `And ${term}? Give me the plain version.`,
  (term) => `Why does ${term} matter here?`,
  (term) => `Pretend I have never heard of ${term}. What is it?`,
]

// Key-point labels may be a term or a whole claim ("The transport layer
// delivers data end to end"), so these frames have to read well for a phrase
// and for a sentence alike.
const ASK_KEY_POINT = [
  (label) => `Let's take ${label}. Why does that matter?`,
  (label) => `Walk me through ${label}.`,
  (label) => `Explain ${label}, like I am going to be tested on it.`,
]

/**
 * Write an episode out of the notes, cards and questions that already exist for
 * a material — no AI key and no network. Every line is a piece of the material
 * said out loud, which is also why this is the writer the app can always fall
 * back to.
 *
 * The word budget is spent topic by topic: each topic gets its share of the
 * episode and is filled with the best beats the material supports (teach, ask,
 * list, quiz, key point) until that share is used up. A thin material therefore
 * makes a shorter episode instead of a padded one, and a long one reaches every
 * topic.
 */
export function buildPodcastFromPack({ material, length, section }) {
  const pack = material?.pack || {}
  const loaded = (pack.sections || []).filter((s) => s.summary?.length || s.terms?.length || s.groups?.length)
  if (!loaded.length) throw new Error('This material has no notes to talk about yet')

  // One topic means one topic: everything the episode is built from is scoped to
  // that section, including the quiz questions it checks itself with.
  const chosen = section ? [section] : pickSections(loaded, length.sections)
  const title = cleanTitle(section?.title || material.title, 'Study Session')
  const out = []
  const say = (speaker, text) => {
    const line = cleanLine(text)
    if (line.length >= 3) {
      out.push({ speaker, text: line })
      return wordsOf(line)
    }
    return 0
  }

  // What is already gone from the material, so no term or question is asked twice.
  const usedTerms = new Set()
  const usedQuestions = new Set()
  const spokenSoFar = []

  const freshTerm = (section, { avoidCovered = false } = {}) =>
    (section.terms || [])
      .filter((t) => usableTerm(t.term))
      .find((t) => {
        const key = cleanLine(t.term).toLowerCase()
        if (usedTerms.has(key)) return false
        // A definition the topic already read out is not worth asking about again.
        if (avoidCovered) {
          const head = cleanLine(t.def).slice(0, 40).toLowerCase()
          if (head && spokenSoFar.some((line) => line.includes(head))) return false
        }
        return true
      })

  const termBeat = (section, index, options) => {
    const term = freshTerm(section, options)
    if (!term) return 0
    usedTerms.add(cleanLine(term.term).toLowerCase())
    const name = cleanLine(term.term).replace(/^(?:the|a|an)\s+/i, '')
    let words = say('milo', ASK_TERM[index % ASK_TERM.length](name))
    words += say('echo', termLine(name, term.def))
    return words
  }

  const listBeat = (section) => {
    const list = listLine((section.groups || []).flatMap((g) => g.items || []), 4)
    if (!list) return 0
    let words = say('milo', `There is a list here: ${list}. That is a lot to hold in your head.`)
    const keep = (section.terms || []).filter((t) => usableTerm(t.term)).slice(0, 2).map((t) => cleanLine(t.term))
    words += say(
      'echo',
      keep.length
        ? `You do not need all of it. Hold on to ${listLine(keep, 2)}, and look the rest up when you need it.`
        : 'You do not need all of it at once. Use it as a checklist when you revise.',
    )
    return words
  }

  // Milo's quiz lead-ins, used in order so the same line never lands twice in a row.
  const ASK_QUIZ = ['Quick test, then.', 'Try this one.', 'Here is one for you.', 'You are up.']
  let asked = 0

  /** Ask one of the material's own quiz questions and answer it. */
  const askQuestion = (question, { react = false } = {}) => {
    const options = speakableOptions(question.options)
    const lead = ASK_QUIZ[asked % ASK_QUIZ.length]
    asked++
    let words = say('milo', `${lead} ${cleanLine(question.q)}${options.length ? ` Is it ${listLine(options, 4)}?` : ''}`)
    const answer = options.length ? capitalize(options[question.answer] || '') : ''
    words += say('echo', sentence([answer, cleanLine(question.why || '')].filter(Boolean).join('. ')))
    if (react) words += say('milo', 'Good. I would have guessed wrong.')
    return words
  }

  const recallBeat = (section) => {
    const question = (pack.questions || []).find((q) => q.sectionId === section.id && !usedQuestions.has(q.id) && usableQuestion(q))
    if (!question) return 0
    usedQuestions.add(question.id)
    return askQuestion(question, { react: true })
  }

  const keyPointBeat = (section, index) => {
    const point = (section.keyPoints || []).find((k) => k.label && cleanLine(k.label).length > 3)
    if (!point) return 0
    const label = cleanLine(point.label)
    let words = say('milo', ASK_KEY_POINT[index % ASK_KEY_POINT.length](label))
    // The hint is the sentence the key point was drawn from; without one, the
    // topic's own summary answers the question.
    words += say('echo', sentence(point.hint || section.summary?.[0] || ''))
    return words
  }

  // Opening: the plan, the ground rules, then straight into the first topic.
  say('milo', 'So what are we doing today?')
  if (section) {
    say('echo', `${title}, from ${cleanLine(material.title)}. One topic, all the way through, out loud.`)
    say('milo', 'And I will keep interrupting with the obvious questions.')
    say('echo', 'That is exactly what I want. Let us take it from the top.')
  } else {
    say('echo', `${title}. ${chosen.length} ${chosen.length === 1 ? 'idea' : 'ideas'}, all of them out loud, in order.`)
    say('milo', 'And I will keep interrupting with the obvious questions.')
    say('echo', `That is exactly what I want. Let's start with ${cleanLine(chosen[0].title)}.`)
  }

  // Roughly the words the opening, the recap and the sign-off will use; what is
  // left is divided between the topics.
  const FRAME_WORDS = 300
  const perSection = Math.max(70, Math.round((length.words - FRAME_WORDS) / chosen.length))

  chosen.forEach((section, index) => {
    const prose = sentences(section.summary, length.prose)
    const sectionWords = prose ? [cleanLine(section.title), prose].filter(Boolean).join('. ') : ''
    let spent = sectionWords ? say('echo', index === 0 ? prose : `${cleanLine(section.title)}. ${prose}`) : 0
    if (sectionWords) spokenSoFar.push(cleanLine(sectionWords).toLowerCase())

    // Beats in the order a listener wants them: what it is, then the word that
    // goes with it, then the list, then a question to check themselves.
    const beats = [
      () => termBeat(section, index, { avoidCovered: true }),
      () => listBeat(section),
      () => recallBeat(section),
      () => termBeat(section, index + 1, { avoidCovered: true }),
      () => keyPointBeat(section, index),
      () => recallBeat(section),
    ]
    for (const beat of beats) {
      if (spent >= perSection) break
      spent += beat()
    }
  })

  // A short material asked for a long episode: rather than padding the topics,
  // spend what is left of the budget on questions the topics never reached.
  const spentSoFar = out.reduce((n, s) => n + wordsOf(s.text), 0)
  let room = length.words - FRAME_WORDS - spentSoFar
  const questionPool = section ? (pack.questions || []).filter((q) => q.sectionId === section.id) : pack.questions || []
  const leftovers = questionPool.filter((q) => !usedQuestions.has(q.id) && usableQuestion(q))
  if (room > 150 && leftovers.length >= 2) {
    say('milo', 'Let us go rapid fire through the rest of it.')
    for (const question of leftovers) {
      if (room < 90) break
      room -= askQuestion(question)
      usedQuestions.add(question.id)
    }
  }

  // The words worth carrying out of the episode.
  const recap = chosen
    .flatMap((s) => s.terms || [])
    .filter((t) => usableTerm(t.term) && !usedTerms.has(cleanLine(t.term).toLowerCase()))
    .slice(0, 6)
    .map((t) => termLine(t.term, t.def))
    .filter(Boolean)
  if (recap.length) {
    say('milo', 'Before we stop: what are the words worth keeping?')
    for (let i = 0; i < recap.length; i += 3) {
      // Only the first block needs a lead-in; the rest carry straight on.
      say('echo', [i === 0 ? 'Here they are.' : '', ...recap.slice(i, i + 3)].filter(Boolean).join(' '))
    }
  }

  // Send them off with one concrete thing to do tonight, in this app.
  say('milo', 'So what do I do with all of this?')
  say(
    'echo',
    `Tonight, open ${cleanLine(material.title)} and explain ${cleanLine(chosen[0].title)} out loud without looking at the notes. If it comes out in order you know it, and if it does not, you have just found the gap.`,
  )
  say('milo', 'And if I get stuck halfway?')
  say('echo', 'Then teach it to me in the app. I will mark what you missed, and we will do this again next time.')

  const segments = normalizeScript(out, length)
  if (segments.length < 8) throw new Error('There is not enough in this material to record an episode')
  return episodeFromScript({ title, segments, length: length.id, source: 'built-in', material })
}

/* ------------------------------------------------------------------ *
 * The model writer
 * ------------------------------------------------------------------ */

/**
 * One topic's notes as plain text. The model gets this on its own so a focused
 * episode starts from the distilled version of its subject rather than having
 * to find the topic inside a whole chapter.
 */
function sectionNotes(section) {
  const lines = [`# ${cleanLine(section.title)}`]
  for (const line of section.summary || []) lines.push(sentence(line))
  for (const group of section.groups || []) for (const item of group.items || []) lines.push(`- ${cleanLine(item)}`)
  for (const term of section.terms || []) lines.push(`- ${cleanLine(term.term)}: ${cleanLine(term.def)}`)
  for (const point of section.keyPoints || []) {
    if (point.label) lines.push(`- ${cleanLine(point.label)}${point.hint ? `: ${cleanLine(point.hint)}` : ''}`)
  }
  return lines.filter(Boolean).join('\n').slice(0, 6000)
}

const RULES = (length, section) => `You write one episode of "Study Session", a two-host study podcast made from a single piece of study material. The material is quoted at the end.

The hosts:
- ECHO, the guide. Warm, precise, explains the material, never condescending.
- MILO, the curious co-host. Asks the questions a student would ask, admits what confuses him, keeps the episode moving.

Write the way people talk out loud:
- Plain spoken English with contractions and short sentences.
- One to three sentences per turn, never more than 45 words.
- No markdown, no headings, no bullet characters, no stage directions, no emoji, no speaker names inside a turn, no "in this episode we will" filler.
- Never refer to the file, the PDF, the slides or the transcript. Call it "the material" or by its own name.
- Say numbers and symbols the way they are read aloud.

The content:
${
  section
    ? `- This episode covers ONE topic of the material: "${cleanLine(section.title)}". Everything the hosts say should help a student understand that topic. Other parts of the material are background only — do not tour them.\n- Go deep instead of wide: the intuition, the trap students fall into, and one worked example built from what the material says.\n- Name the topic in the opening turn so a listener knows what this episode is about.`
    : `- Cover the material in its own order, from the first idea to the last. A listener must not be able to tell that the end was rushed.`
}
- Every definition, number, name and step must come from the material. Never invent a fact to sound complete.
- Say the important ideas more than one way: Echo explains, Milo asks about the part students get wrong, Echo answers plainly.
- At least three times, Milo asks a question a real student or a real exam would ask.
- Close with three to five things worth remembering and one concrete thing to do tonight.

Length: about ${length.words} spoken words in total.

Return strictly a JSON object and nothing else (no code fence, no commentary):
{"title": "<episode title, at most 60 characters>", "segments": [{"speaker": "echo" or "milo", "text": "<what that host says>"}]}`

function parseJson(text) {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('No JSON object in the model response')
  return JSON.parse(text.slice(start, end + 1))
}

/**
 * Ask Gemini for the episode. Throws when there is no key, when the material
 * has no readable text, or when the model cannot produce a usable script — the
 * caller falls back to buildPodcastFromPack() in every one of those cases.
 */
export async function writePodcastWithAi({ material, length, section }) {
  if (!podcastAiAvailable()) throw new Error('No AI key configured')
  const context = fullText(material).slice(0, MAX_CONTEXT_CHARS)
  if (context.trim().length < 400) throw new Error('Not enough readable text to write an episode from')

  // A focused episode reads the whole material for grounding, but the notes of
  // the chosen topic are quoted on their own as well: the model gets the
  // distilled version of what the episode is actually about.
  const focus = section ? `\n\nTHE TOPIC THIS EPISODE COVERS:\n"""\n${sectionNotes(section)}\n"""` : ''

  const body = {
    contents: [{ parts: [{ text: `${RULES(length, section)}${focus}\n\nMATERIAL:\n"""\n${context}\n"""` }] }],
    generationConfig: {
      temperature: 0.85,
      responseMimeType: 'application/json',
      maxOutputTokens: 16_384,
      // 2.5 Flash spends output tokens on hidden thinking by default; the whole
      // budget has to go to the script, or the JSON arrives cut in half.
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
    throw new Error(`Gemini API ${res.status}: ${detail.slice(0, 200)}`)
  }

  const data = await res.json()
  const candidate = data.candidates?.[0]
  const text = (candidate?.content?.parts || [])
    .map((p) => p.text || '')
    .join('')
    .trim()
  if (!text) throw new Error(`Gemini returned no script (${candidate?.finishReason || 'empty'})`)

  const raw = parseJson(text)
  const segments = normalizeScript(raw.segments, length)
  if (segments.length < 8) throw new Error('Gemini returned a script that is too short to record')

  return episodeFromScript({ title: raw.title, segments, length: length.id, source: 'ai', material })
}
