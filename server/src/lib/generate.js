// Turns raw text into a "study pack": notes, flashcards, quiz questions and Teach Echo key points.
//
// This is a local, rule-based generator. It finds headings, picks the most informative sentences and
// builds cards and questions from definitions ("X is ...", "X: ..."). It needs no AI key — it is the
// fallback whenever the model is unavailable, so it also has to cover the whole material: every
// section contributes notes, cards and questions, and the ceilings are high enough that a long
// document is represented from its first page to its last.

import { capitalize, shuffle } from './format.js'

const STOP = new Set(
  'a an and are as at be but by for from has have he her his i if in into is it its of on or our she so that the their them then there these they this to was we were what when which who will with you your not no can may also than such more most other some any each both about over under between during after before while where how why do does did done been being just only very'.split(
    ' ',
  ),
)

const BULLET = /^\s*([-•*▪◦·–])\s+/
const NUMBERED_HEAD = /^(chapter|unit|section|module|lesson|part)\s+\d+|^\d+(\.\d+)*[.)]?\s+[A-Z]/i
const DEF_RE =
  /^([A-Z][A-Za-z0-9\-/()' ]{1,48}?)\s+(is|are|refers to|means|is defined as|is called|can be defined as|is known as)\s+(.{12,240}?)\.?$/
const COLON_RE = /^([A-Z][A-Za-z0-9\-/() ]{1,40}):\s+(.{15,220})$/
const BAD_SUBJECT = /^(this|that|it|these|those|there|they|he|she|we|you|here|which|what|each|another|the following)\b/i

// Output ceilings. They are set high on purpose: the pack should cover the whole
// material, and the proportional picks below spread any trimming across it.
const MAX_CARDS = 300
const MAX_QUESTIONS = 240
const CARDS_PER_SECTION = 10
const QUESTIONS_PER_SECTION = 8

const clean = (t) =>
  t
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ /g, ' ')
    .replace(/^\s*\d{1,3}\s*$/gm, '') // lone page numbers
    .replace(/\n{3,}/g, '\n\n')
    .trim()

const sentencesOf = (str) =>
  str
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20)

const shorten = (s, n = 120) => (s.length > n ? s.slice(0, n - 3).replace(/\s+\S*$/, '') + '...' : s)

const words = (s) => (s.toLowerCase().match(/[a-z][a-z-]{3,}/g) || []).filter((w) => !STOP.has(w))

function freq(sentences) {
  const f = new Map()
  for (const s of sentences) for (const w of words(s)) f.set(w, (f.get(w) || 0) + 1)
  return f
}

function topSentences(sentences, n, f) {
  if (sentences.length <= n) return sentences
  const scored = sentences.map((s, i) => {
    const ws = words(s)
    const score = ws.reduce((sum, w) => sum + (f.get(w) || 0), 0) / Math.sqrt(ws.length + 1)
    return { s, i, score }
  })
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.s)
}

function looksLikeHeading(line, next) {
  const t = line.trim()
  if (t.length < 3 || t.length > 70) return false
  if (BULLET.test(t) || /[.,;:?]$/.test(t)) return false
  const ws = t.split(/\s+/)
  if (ws.length > 10) return false
  if (NUMBERED_HEAD.test(t) && t.length < 60) return true
  const letters = t.replace(/[^A-Za-z]/g, '')
  if (letters.length >= 4 && letters === letters.toUpperCase()) return true
  const caps = ws.filter((w) => /^[A-Z]/.test(w)).length
  return !!next && next.trim().length > 50 && ws.length <= 8 && caps / ws.length >= 0.6
}

const titleOf = (line) => line.trim().replace(/^\d+(\.\d+)*[.)]?\s+/, '')

function splitSections(text) {
  const lines = clean(text).split('\n')
  const out = []
  let cur = null
  const push = () => {
    if (cur && cur.lines.join(' ').trim().length > 40) out.push(cur)
  }
  lines.forEach((line, i) => {
    if (!line.trim()) return
    const next = lines.slice(i + 1).find((l) => l.trim())
    if (looksLikeHeading(line, next)) {
      push()
      cur = { title: titleOf(line), lines: [] }
    } else {
      if (!cur) cur = { title: '', lines: [] }
      cur.lines.push(line)
    }
  })
  push()
  if (out.length >= 2) return out

  // No usable headings: cut the text into chunks of eight sentences.
  const sentences = sentencesOf(clean(text).replace(/\n+/g, ' '))
  const chunks = []
  for (let i = 0; i < sentences.length; i += 8) chunks.push({ title: '', lines: [sentences.slice(i, i + 8).join(' ')] })
  return chunks
}

/** Keep the map readable: merge neighbouring sections only when there are far too many. */
function mergeSections(sections, max = 40) {
  if (sections.length <= max) return sections
  const size = Math.ceil(sections.length / max)
  const out = []
  for (let i = 0; i < sections.length; i += size) {
    const group = sections.slice(i, i + size)
    out.push({ title: group[0].title, lines: group.flatMap((g) => g.lines) })
  }
  return out
}

function extractDefs(sentences, bullets) {
  const defs = []
  for (const s of sentences) {
    const m = s.match(DEF_RE)
    if (!m || BAD_SUBJECT.test(m[1])) continue
    const term = m[1].replace(/^(the|a|an)\s+/i, '').trim()
    if (term.split(/\s+/).length > 6) continue
    defs.push({ term, verb: m[2] === 'are' ? 'are' : 'is', def: m[3].trim(), sentence: s })
  }
  for (const b of bullets) {
    const m = b.match(COLON_RE)
    if (m) {
      defs.push({ term: m[1].trim(), verb: 'is', def: m[2].trim(), sentence: `${m[1].trim()}: ${m[2].trim()}` })
      continue
    }
    // Slides often write definitions as bullets: "Mitochondria are the organelles where..."
    const d = b.match(DEF_RE)
    if (d && !BAD_SUBJECT.test(d[1]) && d[1].split(/\s+/).length <= 6) {
      defs.push({ term: d[1].replace(/^(the|a|an)\s+/i, '').trim(), verb: d[2] === 'are' ? 'are' : 'is', def: d[3].trim(), sentence: b })
    }
  }
  return defs
}

const termTokens = (term) => words(term.toLowerCase().replace(/[^a-z0-9 -]/g, ' ')).concat(term.toLowerCase().match(/\b[a-z0-9]{2,3}\b/g) || [])

function buildSection(raw, i) {
  const bullets = raw.lines.filter((l) => BULLET.test(l)).map((l) => l.replace(BULLET, '').trim()).filter((l) => l.length > 2)
  const prose = raw.lines.filter((l) => !BULLET.test(l)).join(' ').replace(/\s+/g, ' ').trim()
  const sentences = sentencesOf(prose)
  const bulletSentences = bullets.filter((b) => b.length > 20)
  const f = freq([...sentences, ...bulletSentences])
  const summary = topSentences(sentences, Math.max(2, Math.min(5, Math.ceil(sentences.length / 4))), f)

  const defs = extractDefs(sentences, bullets)
  const seen = new Set()
  const terms = defs.filter((d) => (seen.has(d.term.toLowerCase()) ? false : seen.add(d.term.toLowerCase()))).slice(0, 12)

  let keyPoints = terms.slice(0, 5).map((d, k) => ({
    id: `k${k + 1}`,
    label: capitalize(d.term),
    match: [d.term.toLowerCase(), ...(termTokens(d.term).length === 1 ? termTokens(d.term) : [])],
    hint: d.sentence,
  }))
  if (keyPoints.length < 2) {
    const keywords = [...f.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([w]) => w)
    keyPoints = keywords.map((w, k) => ({
      id: `k${k + 1}`,
      label: capitalize(w),
      match: [w],
      hint: [...sentences, ...bulletSentences].find((s) => s.toLowerCase().includes(w)) || '',
    }))
  }

  const title = (raw.title || '').trim() || `Part ${i + 1}: ${capitalize([...f.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'Notes')}`
  return {
    section: {
      id: `s${i + 1}`,
      title,
      summary,
      groups: bullets.length ? [{ items: bullets.slice(0, 24) }] : [],
      terms: terms.map((d) => ({ term: capitalize(d.term), def: d.def })),
      keyPoints,
    },
    sentences: [...sentences, ...bulletSentences],
    defs: terms,
  }
}

function options(correct, wrong) {
  const opts = shuffle([correct, ...wrong.slice(0, 3)])
  return { options: opts, answer: opts.indexOf(correct) }
}

/**
 * Trim per-section lists to a ceiling by drawing one item from each section in
 * turn, so a cap shortens every part of the material instead of deleting the
 * sections at the end of it.
 */
function pickBySection(groups, cap) {
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

const wordRe = (w) => new RegExp(`\\b${w}\\b`, 'i')

/** A sentence with its most telling word blanked out, or null when none fits. */
function blankSentence(sentence, keywords) {
  for (const w of keywords) {
    const re = wordRe(w)
    if (!re.test(sentence)) continue
    const blanked = sentence.replace(re, '_____')
    if (blanked === sentence) continue
    const others = keywords.filter((k) => k !== w && !sentence.toLowerCase().includes(k))
    if (others.length < 3) continue
    return { blanked, word: sentence.match(re)[0], others, sentence }
  }
  return null
}

export function generateStudyPack({ text = '', sections: given } = {}) {
  const raw = mergeSections(given?.length ? given : splitSections(text))
  const built = raw.map(buildSection)
  const sections = built.map((b) => b.section)

  const allDefs = []
  const seenTerms = new Set()
  built.forEach((b, i) =>
    b.defs.forEach((d) => {
      if (!seenTerms.has(d.term.toLowerCase())) {
        seenTerms.add(d.term.toLowerCase())
        allDefs.push({ ...d, sectionId: sections[i].id })
      }
    }),
  )

  // Which words are worth blanking in a cloze card or question: the ones the
  // material keeps coming back to, taken from anywhere in it.
  const f = freq(built.flatMap((b) => b.sentences))
  const ranked = [...f.entries()].sort((a, b) => b[1] - a[1]).map(([w]) => w).filter((w) => w.length >= 6)
  const repeated = ranked.filter((w) => (f.get(w) || 0) >= 2)
  const blanks = (repeated.length >= 6 ? repeated : ranked).slice(0, 40)

  // Flashcards: one per definition, then a cloze card from the informative
  // sentences of every section — so a section with no definitions still gets
  // cards, and every part of the material is represented.
  const cardsBySection = built.map((b, i) => {
    const sectionId = sections[i].id
    const out = b.defs.map((d) => ({
      sectionId,
      q: `What ${d.verb} ${d.term}?`,
      a: capitalize(d.def.replace(/\.$/, '')) + '.',
    }))
    for (const s of b.sentences) {
      if (out.length >= CARDS_PER_SECTION) break
      const blank = blankSentence(s, blanks)
      if (blank) out.push({ sectionId, q: blank.blanked, a: capitalize(blank.word) })
    }
    return out
  })
  const cards = pickBySection(cardsBySection, MAX_CARDS).map((c, i) => ({ id: `c${i + 1}`, ...c }))

  // Questions: one per definition — alternating "which term" and "what is" —
  // then fill-in-the-blank from every section's sentences, drawn evenly across
  // the material rather than from its opening pages.
  const questionsBySection = sections.map(() => [])
  const pushQ = (si, q) => {
    if (questionsBySection[si].length < QUESTIONS_PER_SECTION) questionsBySection[si].push(q)
  }
  const hasTermChoices = allDefs.length >= 3

  built.forEach((b, si) => {
    b.defs.forEach((d, k) => {
      if (!hasTermChoices) return
      const others = shuffle(allDefs.filter((o) => o.term.toLowerCase() !== d.term.toLowerCase()))
      if (k % 2 === 0) {
        const { options: opts, answer } = options(d.term, others.map((o) => capitalize(o.term)))
        if (opts.length < 4) return
        pushQ(si, { sectionId: sections[si].id, q: `Which term matches this description: "${shorten(d.def)}"?`, options: opts, answer, why: d.sentence })
      } else {
        const { options: opts, answer } = options(shorten(d.def, 110), others.map((o) => shorten(o.def, 110)))
        if (opts.length < 4) return
        pushQ(si, { sectionId: sections[si].id, q: `What ${d.verb} ${d.term}?`, options: opts, answer, why: d.sentence })
      }
    })
    for (const s of b.sentences) {
      const blank = blankSentence(s, blanks)
      if (!blank) continue
      const { options: opts, answer } = options(blank.word, shuffle(blank.others))
      if (opts.length < 4) continue
      pushQ(si, { sectionId: sections[si].id, q: `Fill in the blank: ${blank.blanked}`, options: opts, answer, why: blank.sentence })
    }
  })

  const questions = pickBySection(questionsBySection, MAX_QUESTIONS).map((q, i) => ({ id: `q${i + 1}`, ...q }))

  return { sections, cards, questions }
}
