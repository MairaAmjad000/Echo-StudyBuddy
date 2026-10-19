import bcrypt from 'bcryptjs'
import { User } from '../models/User.js'
import { Progress } from '../models/Progress.js'
import { Material } from '../models/Material.js'
import { ChatSession } from '../models/ChatSession.js'
import { Podcast } from '../models/Podcast.js'
import { WhiteboardLesson } from '../models/WhiteboardLesson.js'
import { signToken } from '../lib/jwt.js'
import { env, isProd, JWT_EXPIRES_MS } from '../config/env.js'
import { AppError } from '../lib/AppError.js'
import { progressFor } from '../services/progress.service.js'
import { avatarById } from '../lib/avatars.js'
import { levelInfo } from '../lib/stats.js'
import {
  STATE_MAX_AGE_MS,
  clientBase,
  consentUrl,
  exchangeCode,
  fetchProfile,
  googleConfigured,
  newState,
  signState,
  verifyState,
} from '../lib/google.js'

const DUPLICATE = 11000 // MongoDB duplicate-key error code
const SESSION_COOKIE = 'echo_session'
const OAUTH_COOKIE = 'echo_oauth'

// The session token lives only in an httpOnly cookie: JavaScript (and any
// XSS) can never read it, and nothing is stored in localStorage.
//
// In production the cookie is SameSite=None; Secure, because the frontend is
// expected to live on its own domain (say Vercel) while the API lives on
// another. A Lax cookie is simply never sent on a cross-site request, so
// login would look like it worked and then read as signed out. None also
// covers the same-origin case — when /api is proxied, the cookie is
// first-party and rides along exactly the same.
const cookieOpts = () => ({
  httpOnly: true,
  sameSite: isProd ? 'none' : 'lax',
  secure: isProd,
  maxAge: JWT_EXPIRES_MS,
})

// The round-trip state cookie. It rides on top-level GET navigations back from
// Google, which is exactly what sameSite=lax allows, and it is scoped to the
// auth routes so it is never sent anywhere else.
const oauthCookieOpts = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: env.NODE_ENV === 'production',
  path: '/api/auth',
  maxAge: STATE_MAX_AGE_MS,
})

/** Which sign-in methods this server can offer, so the UI only shows live ones. */
export function providers(req, res) {
  res.json({ google: googleConfigured() })
}

/**
 * Only ever bounce back to a path on our own frontend: a `next` of
 * "https://evil.example" or "//evil.example" would turn the callback into an
 * open redirect.
 */
function safeNext(next) {
  const value = typeof next === 'string' ? next.trim() : ''
  return /^\/[^/\\]/.test(value) ? value : '/app'
}

/** Step one of Google sign-in: our own start route, which hands off to Google. */
export function googleStart(req, res) {
  const toLogin = (message) => res.redirect(302, `${clientBase()}/login?authError=${encodeURIComponent(message)}`)
  if (!googleConfigured()) return toLogin('Google sign-in is not set up on this server yet.')

  const state = newState()
  res.cookie(OAUTH_COOKIE, signState({ state, next: safeNext(req.query.next) }), oauthCookieOpts())
  res.redirect(302, consentUrl(state))
}

/**
 * Step two: Google sends the browser back here. Nothing about the request is
 * trusted except the code, and only after the signed state cookie says this
 * browser started the round trip.
 */
export async function googleCallback(req, res) {
  const toLogin = (message) => res.redirect(302, `${clientBase()}/login?authError=${encodeURIComponent(message)}`)
  const state = verifyState(req.cookies?.[OAUTH_COOKIE])
  res.clearCookie(OAUTH_COOKIE, { path: '/api/auth' })

  if (!googleConfigured()) return toLogin('Google sign-in is not set up on this server yet.')
  // "Cancel" on the consent screen comes back as ?error=access_denied.
  if (req.query.error) return toLogin('Google sign-in was cancelled. Try again, or use your email and password.')
  if (!state || !req.query.state || state.state !== req.query.state) {
    return toLogin('That sign-in link expired. Please start again.')
  }
  if (typeof req.query.code !== 'string' || !req.query.code) {
    return toLogin('Google did not send an authorization code. Please try again.')
  }

  let profile
  try {
    profile = await fetchProfile(await exchangeCode(req.query.code))
  } catch (err) {
    console.error('Google sign-in failed:', err.message)
    return toLogin(err instanceof AppError ? err.message : 'Google sign-in failed. Please try again.')
  }

  try {
    // The Google id first: the email on a Google account can change.
    let user = await User.findOne({ googleId: profile.googleId })
    if (!user) {
      user = await User.findOne({ email: profile.email })
      if (user) {
        // Same verified address, so it is the same person signing in a second
        // way: link the account instead of creating a duplicate.
        if (!user.googleId) {
          user.googleId = profile.googleId
          await user.save()
        }
      } else {
        user = await User.create({ name: profile.name, email: profile.email, googleId: profile.googleId })
        await Progress.create({ owner: user._id }) // progress is created with the account
      }
    }

    res.cookie(SESSION_COOKIE, signToken(user._id), cookieOpts())
    res.redirect(302, `${clientBase()}${state.next}`)
  } catch (err) {
    if (err.code === DUPLICATE) {
      return toLogin('An account already uses that email with a password. Log in with your password, then connect Google from settings.')
    }
    console.error('Google sign-in could not open a session:', err)
    return toLogin('We could not finish the sign-in. Please try again.')
  }
}

export async function signup(req, res, next) {
  try {
    const { name, email, password } = req.body
    const existing = await User.findOne({ email }).select('+passwordHash')
    if (existing) {
      const message =
        existing.googleId && !existing.passwordHash
          ? 'That email already signs in with Google. Use "Continue with Google" instead.'
          : 'An account with that email already exists. Log in instead.'
      throw new AppError(409, message)
    }

    const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS)
    const user = await User.create({ name, email, passwordHash })
    await Progress.create({ owner: user._id }) // progress is created with the account

    res.cookie(SESSION_COOKIE, signToken(user._id), cookieOpts())
    res.status(201).json({ user })
  } catch (err) {
    if (err.code === DUPLICATE) {
      // Name the field that actually collided — blaming the email for a
      // Google-id clash sends the student down the wrong path.
      const field = Object.keys(err.keyPattern || {})[0]
      return next(
        new AppError(
          409,
          field === 'googleId'
            ? 'That Google account is already linked to another Echo account.'
            : 'An account with that email already exists.',
        ),
      )
    }
    next(err)
  }
}

export async function login(req, res, next) {
  const { email, password } = req.body
  const user = await User.findOne({ email }).select('+passwordHash')
  if (!user) throw new AppError(401, 'No account uses that email on this server. Create one first.')
  if (!user.passwordHash) {
    throw new AppError(401, 'That account signs in with Google. Choose "Continue with Google" instead.')
  }

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
  await Promise.all([
    Material.deleteMany({ owner: req.user._id }),
    ChatSession.deleteMany({ owner: req.user._id }),
    Podcast.deleteMany({ owner: req.user._id }),
    WhiteboardLesson.deleteMany({ owner: req.user._id }),
    Progress.deleteOne({ owner: req.user._id }),
  ])
  await req.user.deleteOne()
  res.clearCookie(SESSION_COOKIE, cookieOpts())
  res.json({ ok: true })
}
