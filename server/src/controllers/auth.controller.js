import bcrypt from 'bcryptjs'
import { User } from '../models/User.js'
import { Progress } from '../models/Progress.js'
import { Material } from '../models/Material.js'
import { signToken } from '../lib/jwt.js'
import { env, JWT_EXPIRES_MS } from '../config/env.js'
import { AppError } from '../lib/AppError.js'
import { progressFor } from '../services/progress.service.js'
import { avatarById } from '../lib/avatars.js'
import { levelInfo } from '../lib/stats.js'

const DUPLICATE = 11000 // MongoDB duplicate-key error code
const SESSION_COOKIE = 'echo_session'

// The session token lives only in an httpOnly cookie: JavaScript (and any
// XSS) can never read it, and nothing is stored in localStorage.
const cookieOpts = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: env.NODE_ENV === 'production',
  maxAge: JWT_EXPIRES_MS,
})

export async function signup(req, res, next) {
  try {
    const { name, email, password } = req.body
    const existing = await User.findOne({ email })
    if (existing) throw new AppError(409, 'An account with that email already exists. Log in instead.')

    const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS)
    const user = await User.create({ name, email, passwordHash })
    await Progress.create({ owner: user._id }) // progress is created with the account

    res.cookie(SESSION_COOKIE, signToken(user._id), cookieOpts())
    res.status(201).json({ user })
  } catch (err) {
    if (err.code === DUPLICATE) return next(new AppError(409, 'An account with that email already exists.'))
    next(err)
  }
}

export async function login(req, res, next) {
  const { email, password } = req.body
  const user = await User.findOne({ email }).select('+passwordHash')
  if (!user) throw new AppError(401, 'No account uses that email on this server. Create one first.')

  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) throw new AppError(401, 'That password does not match this email. Try again.')

  res.cookie(SESSION_COOKIE, signToken(user._id), cookieOpts())
  res.json({ user })
}

/** Signs out by expiring the session cookie. */
export async function logout(req, res) {
  res.clearCookie(SESSION_COOKIE, cookieOpts())
  res.json({ ok: true })
}

export async function me(req, res) {
  const progress = await progressFor(req.user._id)
  res.json({ user: req.user, progress })
}

/** Update the display name and/or the chosen profile picture. */
export async function updateMe(req, res, next) {
  try {
    const { name, avatar } = req.body
    if (name !== undefined) req.user.name = name.trim()

    if (avatar !== undefined) {
      const picture = avatarById(avatar)
      if (!picture) throw new AppError(400, 'That profile picture does not exist.')
      // The unlock gate is enforced here against server-side XP: a client
      // cannot pick a picture its level has not earned yet.
      const progress = await progressFor(req.user._id)
      const level = levelInfo(progress.xp).level
      if (picture.unlockLevel > level) {
        throw new AppError(403, `That picture unlocks at level ${picture.unlockLevel}. You're level ${level}.`)
      }
      req.user.avatar = picture.id
    }

    await req.user.save()
    res.json({ user: req.user })
  } catch (err) {
    if (err.name === 'ValidationError') return next(new AppError(400, 'Enter a name with at least two letters.'))
    next(err)
  }
}

/** Delete the account and everything that belongs to it. */
export async function deleteAccount(req, res) {
  await Material.deleteMany({ owner: req.user._id })
  await Progress.deleteOne({ owner: req.user._id })
  await req.user.deleteOne()
  res.clearCookie(SESSION_COOKIE, cookieOpts())
  res.json({ ok: true })
}
