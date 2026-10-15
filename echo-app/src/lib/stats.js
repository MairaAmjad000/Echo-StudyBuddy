import { dayKey } from './format.js'

const DAY = 864e5

export function computeStreak(studyDays, now = new Date()) {
  const set = new Set(studyDays)
  const d = new Date(now)
  if (!set.has(dayKey(d))) {
    d.setDate(d.getDate() - 1)
    if (!set.has(dayKey(d))) return 0
  }
  let n = 0
  while (set.has(dayKey(d))) {
    n++
    d.setDate(d.getDate() - 1)
  }
  return n
}

/** The level curve holds 200 levels: 500 XP each, no further level past it. */
export const MAX_LEVEL = 200

export function levelInfo(xp) {
  const size = 500
  const level = Math.min(MAX_LEVEL, Math.floor(xp / size) + 1)
  // At the cap the bar reads full and there is no "next level" to show.
  const maxed = level === MAX_LEVEL
  return { level, into: maxed ? size : xp % size, size, maxed }
}

/** Counts of activity types in the last 7 days. */
export function weeklyCounts(activity, now = Date.now()) {
  const cutoff = now - 7 * DAY
  const out = { upload: 0, quiz: 0, teach: 0, cards: 0, topic: 0 }
  for (const a of activity) if (a.at >= cutoff && a.type in out) out[a.type]++
  return out
}

export function materialProgress(state, material) {
  const ids = new Set(material.pack?.sections?.map((s) => s.id) || [])
  const done = (state.sectionsDone[material.id] || []).filter((id) => ids.has(id)).length
  const total = ids.size
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 }
}

export const readyMaterials = (state) => state.materials.filter((m) => m.status === 'ready' && m.pack?.sections?.length)

/** The next thing to study: the first unfinished section of the material studied last. */
export function pickMission(state) {
  const mats = readyMaterials(state)
  if (!mats.length) return null
  const last = state.lastStudied && mats.find((m) => m.id === state.lastStudied.materialId)
  const incomplete = mats.find((m) => materialProgress(state, m).pct < 100)
  const material = last && materialProgress(state, last).pct < 100 ? last : incomplete || last || mats[0]
  const done = new Set(state.sectionsDone[material.id] || [])
  const idx = material.pack.sections.findIndex((s) => !done.has(s.id))
  const index = idx >= 0 ? idx : material.pack.sections.length - 1
  return { material, section: material.pack.sections[index], index, complete: idx < 0, ...materialProgress(state, material) }
}

/** The five performance attributes. A value of null means there is no data yet. */
export function attributeStats(state, now = new Date()) {
  const q = state.quizLog
  const answered = q.reduce((n, x) => n + x.total, 0)
  const right = q.reduce((n, x) => n + x.correct, 0)
  const fast = q.reduce((n, x) => n + (x.fast || 0), 0)

  const studied = state.materials.filter((m) => state.cardsEasy[m.id])
  const totalCards = studied.reduce((n, m) => n + (m.pack?.cards?.length || 0), 0)
  const easy = studied.reduce((n, m) => n + (state.cardsEasy[m.id]?.length || 0), 0)

  const teach = state.teachLog
  const avgTeach = teach.length ? teach.reduce((n, x) => n + x.score, 0) / teach.length : null

  const weekAgo = new Date(now)
  weekAgo.setDate(weekAgo.getDate() - 6)
  const recentDays = state.studyDays.filter((d) => d >= dayKey(weekAgo)).length

  return [
    { key: 'knowledge', label: 'Knowledge', value: answered ? Math.round((right / answered) * 100) : null, source: 'Quiz accuracy' },
    { key: 'memory', label: 'Memory', value: totalCards ? Math.round((easy / totalCards) * 100) : null, source: 'Cards marked easy' },
    { key: 'problem', label: 'Problem solving', value: avgTeach === null ? null : Math.round(avgTeach), source: 'Teach Echo scores' },
    { key: 'consistency', label: 'Consistency', value: state.studyDays.length ? Math.round((recentDays / 7) * 100) : null, source: 'Days studied this week' },
    { key: 'speed', label: 'Speed', value: answered ? Math.round((fast / answered) * 100) : null, source: 'Quiz answers under 12 seconds' },
  ]
}

/** XP earned, grouped into chart buckets. range: 'week' | 'month' | 'all' */
export function bucketXp(log, range, now = new Date()) {
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)

  if (range === 'week') {
    const out = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(end.getTime() - i * DAY)
      out.push({ label: d.toLocaleDateString('en-US', { weekday: 'short' }), key: dayKey(d), value: 0 })
    }
    for (const e of log) {
      const b = out.find((o) => o.key === dayKey(e.at))
      if (b) b.value += e.amount
    }
    return out
  }

  if (range === 'month') {
    const start = end.getTime() - 28 * DAY
    const out = [1, 2, 3, 4].map((n) => ({ label: `W${n}`, value: 0 }))
    for (const e of log) {
      const idx = Math.floor((e.at - start) / (7 * DAY))
      if (idx >= 0 && idx < 4) out[idx].value += e.amount
    }
    return out
  }

  const out = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push({ label: d.toLocaleDateString('en-US', { month: 'short' }), y: d.getFullYear(), m: d.getMonth(), value: 0 })
  }
  for (const e of log) {
    const d = new Date(e.at)
    const b = out.find((o) => o.y === d.getFullYear() && o.m === d.getMonth())
    if (b) b.value += e.amount
  }
  return out
}

/** Percent change in XP, this calendar month against the last one. Null when there is nothing to compare. */
export function monthChange(log, now = new Date()) {
  const sum = (y, m) => log.reduce((n, e) => (new Date(e.at).getFullYear() === y && new Date(e.at).getMonth() === m ? n + e.amount : n), 0)
  const cur = sum(now.getFullYear(), now.getMonth())
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prev = sum(prevDate.getFullYear(), prevDate.getMonth())
  return prev ? Math.round(((cur - prev) / prev) * 100) : null
}
