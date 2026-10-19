import crypto from 'node:crypto'
import mongoose from 'mongoose'
import { Material } from '../models/Material.js'
import { Podcast } from '../models/Podcast.js'
import { XP } from '../lib/xp.js'
import { AppError } from '../lib/AppError.js'
import { VOICE_PRESETS, presetById, DEFAULT_PRESET, synthesize } from '../lib/tts.js'
import {
  PODCAST_LENGTHS,
  DEFAULT_LENGTH,
  buildPodcastFromPack,
  writePodcastWithAi,
  lengthById,
  minutesFor,
} from '../lib/podcast.js'
import { progressFor, addActivity, awardXp, commit } from '../services/progress.service.js'

/** The hosts' names are fixed; only the voices change between presets. */
const HOSTS = { echo: 'Echo', milo: 'Milo' }

/**
 * An episode as the client sees it. The list omits the script (a long episode is
 * tens of kilobytes of text) and only the episode being opened carries it.
 */
function toClient(doc, { full = false } = {}) {
  const preset = presetById(doc.preset)
  const base = {
    id: String(doc._id),
    title: doc.title,
    materialId: doc.material ? String(doc.material) : '',
    materialTitle: doc.materialTitle || '',
    // Empty when the episode covers the whole material rather than one topic.
    sectionId: doc.sectionId || '',
    sectionTitle: doc.sectionTitle || '',
    preset: doc.preset,
    presetLabel: preset.label,
    length: doc.length,
    source: doc.source,
    hosts: { echo: preset.hosts.echo.name, milo: preset.hosts.milo.name },
    seconds: doc.seconds || 0,
    minutes: minutesFor(doc.seconds || 0),
    words: doc.words || 0,
    turns: (doc.segments || []).length,
    position: doc.position || 0,
    createdAt: doc.createdAt,
  }
  if (!full) return base
  return {
    ...base,
    segments: (doc.segments || []).map((s) => ({
      id: s.id,
      speaker: s.speaker,
      text: s.text,
      seconds: s.seconds,
    })),
  }
}

/** GET /api/podcasts — the student's episodes, newest first, with the options a
 * new episode can be recorded with. */
export async function list(req, res) {
  const episodes = await Podcast.find({ owner: req.user._id }).sort({ updatedAt: -1 }).limit(40).lean()
  res.set('Cache-Control', 'private, no-store')
  res.json({
    episodes: episodes.map((e) => toClient(e)),
    presets: VOICE_PRESETS.map((p) => ({
      value: p.id,
      label: p.label,
      hosts: `${p.hosts.echo.name} and ${p.hosts.milo.name}`,
    })),
    lengths: PODCAST_LENGTHS.map((l) => ({ value: l.id, label: l.label })),
    hosts: HOSTS,
  })
}

/** GET /api/podcasts/:id — one episode, with its whole script. */
export async function show(req, res, next) {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return next(new AppError(404, 'That episode no longer exists'))
  const episode = await Podcast.findOne({ _id: req.params.id, owner: req.user._id }).lean()
  if (!episode) return next(new AppError(404, 'That episode no longer exists'))
  res.set('Cache-Control', 'private, no-store')
  res.json(toClient(episode, { full: true }))
}

/**
 * POST /api/podcasts — write and save an episode from one of the student's
 * materials.
 *
 * The script comes from Gemini when a key is configured and from the built-in
 * writer otherwise, exactly like notes and flashcards do. Only the script is
 * written here: the voices are recorded on demand, one turn at a time, the first
 * time each turn is played, so a long episode does not sit the student in front
 * of a spinner for a minute before they hear anything.
 */
export async function create(req, res, next) {
  const { materialId, sectionId, preset, length } = req.body
  if (!mongoose.Types.ObjectId.isValid(materialId)) return next(new AppError(404, 'Material not found'))

  const material = await Material.findOne({ _id: materialId, owner: req.user._id }).select('+sourceText').lean()
  if (!material) return next(new AppError(404, 'Material not found'))
  if (material.status !== 'ready' || !material.pack?.sections?.length) {
    return next(new AppError(422, 'Echo has no notes for this material yet. Add the text first.'))
  }

  // A topic is optional: without one the episode walks the whole material.
  const section = sectionId ? material.pack.sections.find((s) => s.id === sectionId) : null
  if (sectionId && !section) return next(new AppError(422, 'That topic is not part of this material.'))

  const chosenLength = lengthById(length || DEFAULT_LENGTH)
  const chosenPreset = presetById(preset || DEFAULT_PRESET)

  let script = null
  try {
    script = await writePodcastWithAi({ material, length: chosenLength, section })
  } catch (err) {
    console.warn(`AI podcast script failed, using the built-in writer instead: ${err.message}`)
  }
  if (!script) {
    try {
      script = buildPodcastFromPack({ material, length: chosenLength, section })
    } catch (err) {
      console.warn(`Built-in podcast script failed: ${err.message}`)
      return next(new AppError(422, 'Echo could not write an episode from this material yet. Try a longer one.'))
    }
  }

  // Each turn carries the voice that records it, so playback never depends on
  // the preset list.
  const segments = script.segments.map((s) => ({ ...s, voice: chosenPreset.hosts[s.speaker].voice }))

  const episode = await Podcast.create({
    owner: req.user._id,
    material: material._id,
    materialTitle: material.title,
    sectionId: section?.id || '',
    sectionTitle: section ? String(section.title || '').slice(0, 160) : '',
    title: script.title,
    preset: chosenPreset.id,
    length: script.length,
    source: script.source,
    segments,
    seconds: script.seconds,
    words: script.words,
    position: 0,
  })

  const p = await progressFor(req.user._id)
  addActivity(p, 'podcast', `Episode recorded: ${episode.title}`)
  awardXp(p, XP.podcast)
  const { progress, unlocked, level } = await commit(p)

  res.status(201).json({ episode: toClient(episode, { full: true }), progress, unlocked, level })
}

/**
 * GET /api/podcasts/:id/audio/:index — record one turn and send it back as MP3.
 *
 * Turn addresses instead of one file for the whole episode: the first turn is
 * playable about two seconds after it is asked for, the rest are recorded while
 * the student listens, and nothing has to be stored on a host with no disk.
 * Because a turn is a pure function of its text and its voice, the response can
 * be cached by the browser for good — on the way to class, a re-listen costs no
 * requests at all.
 */
export async function audio(req, res, next) {
  const { id, index } = req.params
  if (!mongoose.Types.ObjectId.isValid(id)) return next(new AppError(404, 'That episode no longer exists'))

  const episode = await Podcast.findOne({ _id: id, owner: req.user._id }).lean()
  if (!episode) return next(new AppError(404, 'That episode no longer exists'))

  const at = Number(index)
  const segment = Number.isInteger(at) && at >= 0 ? episode.segments[at] : null
  if (!segment) return next(new AppError(404, 'That turn is not part of this episode'))

  const etag = `"${crypto.createHash('sha1').update(`${segment.voice}|${segment.text}`).digest('hex').slice(0, 20)}"`
  if (req.headers['if-none-match'] === etag) {
    res.set('ETag', etag)
    return res.status(304).end()
  }

  try {
    const mp3 = await synthesize({ voice: segment.voice, text: segment.text })
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': String(mp3.length),
      'Cache-Control': 'private, max-age=604800, immutable',
      ETag: etag,
    })
    res.send(mp3)
  } catch (err) {
    if (err.unavailable) {
      // The free Edge voices rate-limit bursts. This is temporary, so say so and
      // let the player's retry button do its job.
      res.set('Retry-After', '5')
      return next(new AppError(503, 'Echo\u2019s voice needs a few seconds. Try that turn again.'))
    }
    next(err)
  }
}

/** PATCH /api/podcasts/:id — remember the turn the student stopped at. */
export async function savePosition(req, res, next) {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return next(new AppError(404, 'That episode no longer exists'))
  const episode = await Podcast.findOne({ _id: req.params.id, owner: req.user._id })
  if (!episode) return next(new AppError(404, 'That episode no longer exists'))

  const last = Math.max(0, (episode.segments?.length || 1) - 1)
  const position = Math.min(last, Math.max(0, Math.floor(req.body.index)))
  episode.position = position
  episode.listenedAt = new Date()
  await episode.save()
  res.json({ ok: true, position })
}

/** DELETE /api/podcasts/:id — throw one episode away. */
export async function remove(req, res, next) {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return next(new AppError(404, 'That episode no longer exists'))
  const removed = await Podcast.findOneAndDelete({ _id: req.params.id, owner: req.user._id })
  if (!removed) return next(new AppError(404, 'That episode no longer exists'))
  res.json({ ok: true })
}
