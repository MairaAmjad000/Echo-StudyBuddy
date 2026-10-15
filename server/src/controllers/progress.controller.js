import { Material } from '../models/Material.js'
import { XP } from '../lib/xp.js'
import { uid } from '../lib/format.js'
import { demoProgress } from '../lib/demo.js'
import { AppError } from '../lib/AppError.js'
import {
  computeStreak,
  levelInfo,
  weeklyCounts,
  materialProgress,
  pickMission,
  attributeStats,
  bucketXp,
  monthChange,
} from '../lib/stats.js'
import { progressFor, addActivity, awardXp, commit, patchState } from '../services/progress.service.js'

/** Full progress state for the signed-in user. */
export async function get(req, res) {
  const progress = await progressFor(req.user._id)
  res.json(progress)
}

/**
 * Derived dashboard/performance data, computed server-side from the
 * user's materials and progress. One round trip for the whole page.
 */
export async function summary(req, res) {
  const progress = await progressFor(req.user._id)
  const materials = await Material.find({ owner: req.user._id }).lean()
  const state = { ...progress.toObject(), materials: materials.map((m) => ({ ...m, id: m._id.toString() })) }

  res.json({
    streak: computeStreak(state.studyDays),
    level: levelInfo(state.xp),
    weekly: weeklyCounts(state.activity),
    mission: pickMission(state),
    attributes: attributeStats(state),
    buckets: {
      week: bucketXp(state.xpLog, 'week'),
      month: bucketXp(state.xpLog, 'month'),
      all: bucketXp(state.xpLog, 'all'),
    },
    monthChange: monthChange(state.xpLog),
  })
}

/** The material must belong to the caller before any event is recorded. */
async function ownedMaterial(userId, materialId) {
  return Material.findOne({ _id: materialId, owner: userId }).lean()
}

export async function recordQuiz(req, res, next) {
  const { materialId, correct, total, defeated, fast, boss } = req.body
  const material = await ownedMaterial(req.user._id, materialId)
  if (!material) return next(new AppError(404, 'Material not found'))

  const p = await progressFor(req.user._id)
  const at = Date.now()
  p.quizLog = [...p.quizLog.slice(-199), { at, materialId, correct, total, defeated, fast, boss }]

  const xp = correct * XP.quizCorrect + (defeated ? XP.quizWin : 0)
  awardXp(p, xp)
  const pct = total ? Math.round((correct / total) * 100) : 0
  addActivity(p, 'quiz', `${boss ? 'Boss round' : 'Quiz'} completed. Score ${pct}%`)

  const result = await commit(p)
  res.json({ xp, progress: result.progress, unlocked: result.unlocked, level: result.level })
}

export async function recordCards(req, res, next) {
  const { materialId, easyIds, hardCount } = req.body
  const material = await ownedMaterial(req.user._id, materialId)
  if (!material) return next(new AppError(404, 'Material not found'))

  const p = await progressFor(req.user._id)
  const union = [...new Set([...(p.cardsEasy?.[materialId] || []), ...easyIds])]
  patchState(p, { cardsEasy: { ...(p.cardsEasy || {}), [materialId]: union } })

  const xp = union.length * XP.cardEasy + hardCount * XP.cardHard
  awardXp(p, xp)
  addActivity(p, 'cards', `Flashcards reviewed. ${union.length} marked easy`)

  const result = await commit(p)
  res.json({ xp, progress: result.progress, unlocked: result.unlocked, level: result.level })
}

export async function recordTeach(req, res, next) {
  const { materialId, sectionId, topic, score } = req.body
  const material = await ownedMaterial(req.user._id, materialId)
  if (!material) return next(new AppError(404, 'Material not found'))

  const p = await progressFor(req.user._id)
  const at = Date.now()
  p.teachLog = [...p.teachLog.slice(-99), { at, materialId, sectionId, topic, score }]

  const xp = XP.teach(score)
  awardXp(p, xp)
  addActivity(p, 'teach', `Teach Echo on ${topic}. Score ${score}%`)

  const result = await commit(p)
  res.json({ xp, progress: result.progress, unlocked: result.unlocked, level: result.level })
}

/** Mark a topic done/undone. XP is awarded once per topic. */
export async function toggleSection(req, res, next) {
  const { materialId } = req.params
  const { sectionId, title, done } = req.body
  const material = await ownedMaterial(req.user._id, materialId)
  if (!material) return next(new AppError(404, 'Material not found'))

  const p = await progressFor(req.user._id)
  const cur = p.sectionsDone?.[materialId] || []
  const next_ = done
    ? cur.includes(sectionId) ? cur : [...cur, sectionId]
    : cur.filter((x) => x !== sectionId)
  patchState(p, { sectionsDone: { ...(p.sectionsDone || {}), [materialId]: next_ } })
  p.lastStudied = { materialId, sectionId }

  const key = `${materialId}:${sectionId}`
  if (done && !(p.xpAwarded || {})[key]) {
    awardXp(p, XP.topicDone)
    addActivity(p, 'topic', `Finished topic: ${title}`)
    patchState(p, { xpAwarded: { ...(p.xpAwarded || {}), [key]: true } })
  }

  const result = await commit(p)
  res.json({ progress: result.progress, unlocked: result.unlocked, level: result.level })
}

/** Remember what the user is studying. */
export async function touch(req, res, next) {
  const { materialId, sectionId } = req.body
  const material = await ownedMaterial(req.user._id, materialId)
  if (!material) return next(new AppError(404, 'Material not found'))

  const p = await progressFor(req.user._id)
  p.lastStudied = { materialId, sectionId }
  const result = await commit(p)
  res.json({ progress: result.progress, unlocked: result.unlocked, level: result.level })
}

export async function updateSettings(req, res) {
  const p = await progressFor(req.user._id)
  patchState(p, { settings: { ...(p.settings || {}), ...req.body } })
  const result = await commit(p)
  res.json({ settings: p.settings, progress: result.progress, unlocked: result.unlocked, level: result.level })
}

/** Fill in believable progress so every page can be seen with data. */
export async function loadDemo(req, res, next) {
  const materials = await Material.find({ owner: req.user._id }).lean()
  const mat = materials.find((m) => m.sample) || materials[0]
  if (!mat) return next(new AppError(400, 'Upload something first, then load the demo.'))

  const p = await progressFor(req.user._id)
  const demo = demoProgress(mat._id.toString())
  patchState(p, demo)
  const result = await commit(p)
  res.json({ progress: result.progress, unlocked: result.unlocked, level: result.level })
}

/** Wipe study progress. Materials and the account stay. */
export async function resetProgress(req, res) {
  const p = await progressFor(req.user._id)
  p.quizLog = []
  p.teachLog = []
  p.xp = 0
  p.xpLog = []
  p.studyDays = []
  p.activity = []
  p.lastStudied = null
  patchState(p, { sectionsDone: {}, cardsEasy: {}, achievements: {}, xpAwarded: {} })
  await p.save()
  res.json({ progress: p })
}


