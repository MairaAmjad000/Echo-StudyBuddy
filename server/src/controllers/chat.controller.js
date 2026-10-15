import mongoose from 'mongoose'
import { Material } from '../models/Material.js'
import { ChatSession } from '../models/ChatSession.js'
import { env } from '../config/env.js'
import { askEcho, chatAvailable } from '../lib/chat.js'
import { AppError } from '../lib/AppError.js'

// The stored thread is trimmed to this many messages (hundreds of turns is far
// more than the model ever sees, and it keeps the document small).
const MAX_STORED = 200

/** A readable name for a conversation: the first thing the student asked. */
function titleFrom(messages) {
  const first = messages.find((m) => m.role === 'user' && m.content)
  const text = (first?.content || 'New chat').trim().replace(/\s+/g, ' ')
  return text.length > 60 ? `${text.slice(0, 57)}...` : text
}

/**
 * Store the thread after an answer. The client owns the conversation (it sends
 * the whole thing every time), so the stored copy is simply replaced with the
 * thread that produced this reply — never appended twice.
 */
async function saveTurn({ user, material, messages, reply, sessionId }) {
  const now = Date.now()
  const thread = [...messages, { role: 'echo', content: reply, at: now }]
    .filter((m) => m?.content)
    .slice(-MAX_STORED)
    .map((m) => ({ role: m.role === 'echo' ? 'echo' : 'user', content: m.content, at: m.at || now }))

  const existing =
    sessionId && mongoose.Types.ObjectId.isValid(sessionId)
      ? await ChatSession.findOne({ _id: sessionId, owner: user._id })
      : null

  if (existing) {
    existing.messages = thread
    existing.turnCount = thread.length
    existing.material = material._id
    existing.materialTitle = material.title
    if (!existing.title || existing.title === 'New chat') existing.title = titleFrom(thread)
    await existing.save()
    return existing
  }

  return ChatSession.create({
    owner: user._id,
    material: material._id,
    materialTitle: material.title,
    title: titleFrom(thread),
    turnCount: thread.length,
    messages: thread,
  })
}

/** GET /api/chat/sessions — the student's past conversations, newest first. */
export async function listSessions(req, res) {
  const sessions = await ChatSession.find({ owner: req.user._id })
    .sort({ updatedAt: -1 })
    .limit(60)
    .select('title material materialTitle turnCount updatedAt')
    .lean()

  res.set('Cache-Control', 'private, no-store')
  res.json({
    sessions: sessions.map((s) => ({
      id: String(s._id),
      title: s.title,
      materialId: s.material ? String(s.material) : '',
      materialTitle: s.materialTitle || '',
      turnCount: s.turnCount || 0,
      updatedAt: s.updatedAt,
    })),
  })
}

/** GET /api/chat/sessions/:id — one conversation, with its messages. */
export async function getSession(req, res, next) {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return next(new AppError(404, 'That conversation no longer exists'))
  const session = await ChatSession.findOne({ _id: req.params.id, owner: req.user._id }).lean()
  if (!session) return next(new AppError(404, 'That conversation no longer exists'))

  res.set('Cache-Control', 'private, no-store')
  res.json({
    id: String(session._id),
    title: session.title,
    materialId: session.material ? String(session.material) : '',
    materialTitle: session.materialTitle || '',
    messages: (session.messages || []).map((m) => ({ role: m.role, content: m.content, at: m.at })),
  })
}

/** DELETE /api/chat/sessions/:id — forget one conversation. */
export async function removeSession(req, res, next) {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return next(new AppError(404, 'That conversation no longer exists'))
  const removed = await ChatSession.findOneAndDelete({ _id: req.params.id, owner: req.user._id })
  if (!removed) return next(new AppError(404, 'That conversation no longer exists'))
  res.json({ ok: true })
}

/**
 * POST /api/chat — answer a question about one of the user's materials.
 *
 * The client sends the whole conversation (so a reloaded page keeps its
 * context) and the server keeps only the last few turns, grounded in the
 * material's own text. The thread is also saved so it shows up in the chat
 * history; pass the `sessionId` from a previous answer to keep appending to
 * the same conversation.
 */
export async function ask(req, res, next) {
  const { materialId, messages, sessionId } = req.body

  // A malformed id must be a 404, not a Mongoose cast error.
  if (!mongoose.Types.ObjectId.isValid(materialId)) return next(new AppError(404, 'Material not found'))

  const material = await Material.findOne({ _id: materialId, owner: req.user._id })
    .select('+sourceText')
    .lean()
  if (!material) return next(new AppError(404, 'Material not found'))
  if (material.status !== 'ready' || !material.pack?.sections?.length) {
    return next(new AppError(422, 'Echo has no notes for this material yet. Add the text first.'))
  }
  if (!chatAvailable()) {
    return next(new AppError(503, 'Chat needs an AI key. Add AI_API_KEY to the server .env and restart.'))
  }

  try {
    const reply = await askEcho({ material, messages })
    const session = await saveTurn({ user: req.user, material, messages, reply, sessionId })
    // Private, per-user content: never let a proxy or the browser cache it.
    res.set('Cache-Control', 'private, no-store')
    res.json({ reply, materialId, sessionId: String(session._id), model: env.AI_MODEL })
  } catch (err) {
    console.error('Chat with Echo failed:', err.message)
    // Out of AI quota is not a bug: say what it is and what the student can do.
    if (err.quota) {
      return next(new AppError(429, 'Echo has used up its AI quota for now. Wait a minute and ask again.'))
    }
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return next(new AppError(504, 'That answer took too long. Ask again in a moment.'))
    }
    next(new AppError(502, 'Echo could not answer that just now. Try again in a moment.'))
  }
}
