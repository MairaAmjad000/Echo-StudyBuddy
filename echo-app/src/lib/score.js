// Scores a Teach Echo explanation against a topic's key points.
// This runs locally: a key point counts as covered when its words appear in the explanation.

const normalize = (s) =>
  ' ' +
  s
    .toLowerCase()
    .replace(/syn[\s-]*ack/g, 'synack') // keep SYN-ACK distinct from SYN
    .replace(/[^a-z0-9]+/g, ' ')
    .trim() +
  ' '

const hasToken = (norm, t) =>
  norm.includes(` ${t} `) ||
  norm.includes(` ${t}s `) ||
  (t.endsWith('s') && norm.includes(` ${t.slice(0, -1)} `))

const matchEntry = (norm, entry) => normalize(entry).trim().split(' ').every((t) => hasToken(norm, t))

// Common words that make useless key points when a section has none stored.
const STOP = new Set([
  'about', 'above', 'after', 'again', 'against', 'because', 'before', 'being', 'between', 'could', 'every', 'first',
  'found', 'their', 'there', 'these', 'thing', 'those', 'through', 'under', 'where', 'which', 'while', 'would',
  'other', 'using', 'used', 'this', 'that', 'with', 'from', 'into', 'when', 'they', 'them', 'then', 'than', 'your',
  'also', 'some', 'such', 'only', 'more', 'most', 'much', 'many', 'very', 'will', 'have', 'has', 'does', 'like',
  'means', 'called', 'known', 'given', 'takes', 'makes', 'used', 'based', 'work', 'works', 'thing', 'things',
])

/**
 * The key points to score an explanation against. Packs normally carry them,
 * but a section written by the AI can arrive without any — so build them from
 * the section's own terms and summary rather than refusing to score at all.
 */
export function keyPointsFor(section) {
  const own = section?.keyPoints
  if (own?.length) return own

  const points = []
  const seen = new Set()
  for (const t of section?.terms || []) {
    const term = String(t?.term || '').trim()
    if (!term) continue
    const key = term.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    points.push({ id: `k${points.length + 1}`, label: term, match: [key], hint: t.def || '' })
    if (points.length >= 5) break
  }

  // Still thin: fall back to the most meaningful words in the section's text.
  if (points.length < 2) {
    const text = [...(section?.summary || []), ...(section?.groups || []).flatMap((g) => g?.items || [])].join(' ')
    const words = [...new Set((text.toLowerCase().match(/\b[a-z][a-z0-9-]{3,}\b/g) || []))]
    for (const w of words) {
      if (points.length >= 4) break
      if (STOP.has(w) || seen.has(w)) continue
      seen.add(w)
      points.push({ id: `k${points.length + 1}`, label: w, match: [w], hint: '' })
    }
  }

  return points
}

export function scoreExplanation(text, keyPoints) {
  const norm = normalize(text)
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0
  if (!keyPoints?.length) return { score: null, covered: [], missed: [], wordCount }
  const covered = []
  const missed = []
  for (const kp of keyPoints) {
    ;(kp.match.some((m) => matchEntry(norm, m)) ? covered : missed).push(kp)
  }
  return {
    score: Math.round((covered.length / keyPoints.length) * 100),
    covered,
    missed,
    wordCount,
  }
}

export function feedbackLine(score) {
  if (score >= 85) return 'Great explanation. Here is my feedback.'
  if (score >= 60) return 'Good start. A few points are still missing.'
  if (score >= 30) return 'You have part of it. Check what you skipped.'
  return 'Not much of the topic came through. Read the notes and try again.'
}
