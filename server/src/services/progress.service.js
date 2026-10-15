// Shared progress operations: XP, activity feed and achievement evaluation.
// XP is awarded here, server-side, so clients cannot inflate their own scores.

import { Progress } from '../models/Progress.js'
import { Material } from '../models/Material.js'
import { ACHIEVEMENTS, isUnlocked } from '../lib/achievements.js'
import { levelInfo } from '../lib/stats.js'
import { uid, dayKey } from '../lib/format.js'

/** The user's progress document, created on first access. */
export async function progressFor(userId) {
  let progress = await Progress.findOne({ owner: userId })
  if (!progress) progress = await Progress.create({ owner: userId })
  return progress
}

export function addActivity(p, type, text) {
  p.activity = [{ id: uid('a'), type, text, at: Date.now() }, ...p.activity].slice(0, 60)
}

// Mongoose does not track reassignment of Mixed (plain Object) paths.
// set() + markModified() forces the change into the next save().
const MIXED_PATHS = ['sectionsDone', 'cardsEasy', 'achievements', 'xpAwarded']

/** Apply a partial update to the progress doc that is guaranteed to persist. */
export function patchState(p, patch) {
  for (const [key, value] of Object.entries(patch)) {
    p.set(key, value)
    if (MIXED_PATHS.includes(key)) p.markModified(key)
  }
}

/** Award XP and stamp the study day. No-op for non-positive amounts. */
export function awardXp(p, amount) {
  if (!amount || amount <= 0) return
  const at = Date.now()
  p.xp += amount
  p.xpLog = [...p.xpLog.slice(-999), { at, amount }]
  const day = dayKey(at)
  if (!p.studyDays.includes(day)) p.studyDays = [...p.studyDays.slice(-399), day]
}

/** The combined state the achievement rules read: progress plus materials. */
async function stateFor(p) {
  const materials = await Material.find({ owner: p.owner }).lean()
  // lean() skips toJSON, so expose the string id the client keys progress by.
  return { ...p.toObject(), materials: materials.map((m) => ({ ...m, id: m._id.toString() })) }
}

/**
 * Persists a mutation and evaluates achievements against the saved state.
 * Returns the progress document, any newly unlocked achievements and the level.
 */
export async function commit(p) {
  await p.save()
  const state = await stateFor(p)
  const fresh = ACHIEVEMENTS.filter((a) => !p.achievements?.[a.id] && isUnlocked(a, state))
  if (fresh.length) {
    patchState(p, {
      achievements: { ...(p.achievements || {}), ...Object.fromEntries(fresh.map((a) => [a.id, Date.now()])) },
    })
    await p.save()
  }
  return {
    progress: p,
    unlocked: fresh.map((a) => ({ id: a.id, title: a.title, text: a.text })),
    level: levelInfo(p.xp),
  }
}
