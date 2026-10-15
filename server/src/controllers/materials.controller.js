import { Material } from '../models/Material.js'
import { Progress } from '../models/Progress.js'
import { generateStudyPack } from '../lib/generate.js'
import { generateStudyPackWithAi, aiAvailable } from '../lib/ai.js'
import { XP, MIN_TEXT } from '../lib/xp.js'
import { stripExt, uid } from '../lib/format.js'
import { AppError } from '../lib/AppError.js'
import { progressFor, addActivity, awardXp, commit, patchState } from '../services/progress.service.js'

/** YouTube watch / youtu.be / short links -> video id, or null. */
function parseYouTube(url) {
  try {
    const u = new URL(url.trim())
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') return u.pathname.slice(1) || null
    if (host.endsWith('youtube.com')) return u.searchParams.get('v') || u.pathname.split('/').filter(Boolean).pop() || null
  } catch {
    /* not a URL */
  }
  return null
}

/** Shortest material worth sending to the model. */
const AI_MIN_TEXT = 600

/**
 * Build the pack: the client's own when it sent one, otherwise a read of the
 * whole material by the model, otherwise the rule-based generator.
 *
 * The model gets every material with enough readable text — a plain transcript,
 * a PDF's extracted text, or the sections the browser already parsed out of a
 * slide deck — so coverage never depends on which format arrived. The pack is
 * re-normalized by the generator/merger, so nothing malformed reaches the DB.
 */
async function buildPackAsync(body) {
  if (body.pack) return body.pack

  const { sections } = body
  let aiError = null
  if (aiAvailable()) {
    const text = sourceTextOf(body)
    if (text.length >= AI_MIN_TEXT) {
      try {
        return await generateStudyPackWithAi(text)
      } catch (err) {
        aiError = err
        console.warn(`AI study pack failed, using the built-in generator instead: ${err.message}`)
      }
    }
  }

  // The built-in generator reads the sections the browser parsed when there are
  // any, and the raw text otherwise.
  const pack = generateStudyPack({ text: body.text || '', sections })
  if (!pack.sections.length) {
    // Never leak raw parser/API internals (e.g. "Expected ',' or ']' after array
    // element...") to the client — just a safe, short reason.
    const aiIssue = aiError instanceof Error && /^Gemini/.test(aiError.message)
    throw new AppError(aiIssue ? 502 : 422, aiIssue
      ? 'The AI could not build notes from this material. Try again, or check its size.'
      : 'Echo could not find enough readable text to build notes from.')
  }
  return pack
}

/**
 * The student's own text as one string. Chat with Echo quotes this when it is
 * available, falling back to the generated notes when a pack is sent without
 * any text.
 */
function sourceTextOf({ text = '', sections } = {}) {
  const joined = sections?.length
    ? sections.map((s) => `## ${s.title}\n${(s.lines || []).join('\n')}`).join('\n\n')
    : text
  return String(joined || '').trim().slice(0, 200_000)
}

/** lean() skips toJSON, so expose the string id the client keys progress by. */
const toClient = (doc) => {
  const { _id, __v, ...rest } = doc
  return { ...rest, id: _id.toString() }
}

export async function list(req, res) {
  const materials = await Material.find({ owner: req.user._id }).sort({ addedAt: -1 }).lean()
  res.json(materials.map(toClient))
}

export async function create(req, res, next) {
  try {
    const { title, type, sourceUrl, sample } = req.body
    const pack = await buildPackAsync(req.body)

    const material = await Material.create({
      owner: req.user._id,
      title: title || stripExt('Untitled'),
      type,
      status: 'ready',
      sourceUrl,
      sample: !!sample,
      pack,
      sourceText: sourceTextOf(req.body) || undefined,
    })

    const p = await progressFor(req.user._id)
    addActivity(p, 'upload', `Notes generated from ${material.title}`)
    awardXp(p, XP.upload)
    const { progress, unlocked, level } = await commit(p)

    res.status(201).json({ material, progress, unlocked, level })
  } catch (err) {
    next(err)
  }
}

export async function show(req, res, next) {
  const material = await Material.findOne({ _id: req.params.id, owner: req.user._id }).lean()
  if (!material) return next(new AppError(404, 'Material not found'))
  res.json(toClient(material))
}

/** Save a YouTube link with its transcript. Both are required — together they become a full material. */
export async function link(req, res, next) {
  try {
    const { url, transcript } = req.body
    const videoId = parseYouTube(url)
    if (!videoId) return next(new AppError(400, 'Enter a valid YouTube link.'))
    // Without enough transcript there is nothing to build notes from, so a
    // link alone is never saved.
    if (transcript.trim().length < MIN_TEXT) {
      return next(new AppError(400, 'Paste a longer transcript, at least a few paragraphs.'))
    }

    const base = {
      owner: req.user._id,
      title: `YouTube video ${videoId}`,
      type: 'youtube',
      sourceUrl: url,
    }

    const pack = await buildPackAsync({ text: transcript.trim() })
    if (!pack.sections.length) return next(new AppError(422, 'Echo could not find enough readable text in that transcript.'))
    const material = await Material.create({ ...base, status: 'ready', pack, sourceText: sourceTextOf({ text: transcript }) })

    const p = await progressFor(req.user._id)
    addActivity(p, 'upload', `Notes generated from ${material.title}`)
    awardXp(p, XP.upload)
    const { progress, unlocked, level } = await commit(p)
    res.status(201).json({ material, progress, unlocked, level })
  } catch (err) {
    next(err)
  }
}

/** Attach a transcript to a "needs-text" material and build its pack. */
export async function complete(req, res, next) {
  try {
    const { transcript } = req.body
    const material = await Material.findOne({ _id: req.params.id, owner: req.user._id })
    if (!material) return next(new AppError(404, 'Material not found'))
    if (transcript.trim().length < MIN_TEXT) {
      return next(new AppError(400, 'Paste a longer transcript, at least a few paragraphs.'))
    }

    const pack = await buildPackAsync({ text: transcript.trim() })

    material.pack = pack
    material.status = 'ready'
    material.sourceText = sourceTextOf({ text: transcript })
    await material.save()

    const p = await progressFor(req.user._id)
    addActivity(p, 'upload', `Notes generated from ${material.title}`)
    awardXp(p, XP.upload)
    const { progress, unlocked, level } = await commit(p)

    res.json({ material, progress, unlocked, level })
  } catch (err) {
    next(err)
  }
}

export async function remove(req, res, next) {
  const material = await Material.findOneAndDelete({ _id: req.params.id, owner: req.user._id })
  if (!material) return next(new AppError(404, 'Material not found'))
  const materialId = material._id.toString()

  // Drop progress references so stale keys never linger.
  const p = await progressFor(req.user._id)
  const patch = {}
  if (p.sectionsDone?.[materialId]) {
    patch.sectionsDone = { ...p.sectionsDone }
    delete patch.sectionsDone[materialId]
  }
  if (p.cardsEasy?.[materialId]) {
    patch.cardsEasy = { ...p.cardsEasy }
    delete patch.cardsEasy[materialId]
  }
  if (Object.keys(patch).length) patchState(p, patch)
  if (p.lastStudied?.materialId === materialId) p.lastStudied = null
  await commit(p)

  res.json({ ok: true })
}
