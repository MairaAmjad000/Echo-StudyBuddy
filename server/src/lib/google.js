import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { AppError } from './AppError.js'

/**
 * Google sign-in, done here rather than through a passport strategy: the flow
 * is two redirects and two HTTP calls, and this way the session stays exactly
 * the same httpOnly cookie the email/password login already uses.
 *
 *   1. /api/auth/google          -> a signed state cookie + redirect to Google
 *   2. /api/auth/google/callback -> check state, swap the code for a token,
 *      read the profile, find-or-create the user, set the session cookie.
 */

const STATE_AUDIENCE = 'echo-google-oauth'
const STATE_TTL = '10m'
export const STATE_MAX_AGE_MS = 10 * 60 * 1000

/** Google is only offered when the server actually has credentials for it. */
export const googleConfigured = () => Boolean(env.GOOGLE_CLIENT_ID.trim() && env.GOOGLE_CLIENT_SECRET.trim())

/** The redirect URI sent to Google; it must be registered on the OAuth client. */
export const redirectUri = () =>
  env.GOOGLE_REDIRECT_URI.trim() || `${env.CLIENT_ORIGIN.replace(/\/+$/, '')}/api/auth/google/callback`

/** Where Google sends the browser back to when the server itself fell over. */
export const clientBase = () => env.CLIENT_ORIGIN.replace(/\/+$/, '')

/** The consent screen URL. `prompt=select_account` so a shared laptop does not silently reuse the last Google account. */
export function consentUrl(state) {
  const url = new URL(env.GOOGLE_AUTH_URL)
  url.searchParams.set('client_id', env.GOOGLE_CLIENT_ID.trim())
  url.searchParams.set('redirect_uri', redirectUri())
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid email profile')
  url.searchParams.set('state', state)
  url.searchParams.set('prompt', 'select_account')
  return url.toString()
}

/**
 * The state travels in a signed, short-lived token held in an httpOnly cookie.
 * Signing it with our own secret is what stops a stranger from handing the
 * callback a code of their own; the cookie is what ties the round trip to this
 * browser.
 */
export const signState = (payload) => jwt.sign(payload, env.JWT_SECRET, { audience: STATE_AUDIENCE, expiresIn: STATE_TTL })

/** The state payload, or null when the cookie is missing, forged or stale. */
export function verifyState(token) {
  if (!token) return null
  try {
    return jwt.verify(token, env.JWT_SECRET, { audience: STATE_AUDIENCE })
  } catch {
    return null
  }
}

/** A fresh unguessable state value. */
export const newState = () => crypto.randomBytes(16).toString('hex')

/** Swap the one-time code for an access token. */
export async function exchangeCode(code) {
  const res = await fetch(env.GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID.trim(),
      client_secret: env.GOOGLE_CLIENT_SECRET.trim(),
      redirect_uri: redirectUri(),
      grant_type: 'authorization_code',
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.access_token) {
    // The detail belongs in the log, not in the student's face.
    console.error(`Google token exchange failed (${res.status}):`, data.error || data.error_description || 'no access token')
    if (data.error === 'invalid_grant') throw new AppError(400, 'That Google sign-in link was already used. Please start again.')
    throw new AppError(502, 'Google would not confirm the sign-in. Please try again.')
  }
  return data.access_token
}

/** The signed-in Google profile, reduced to the four things this app needs. */
export async function fetchProfile(accessToken) {
  const res = await fetch(env.GOOGLE_USERINFO_URL, { headers: { authorization: `Bearer ${accessToken}` } })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.sub) {
    console.error(`Google userinfo failed (${res.status}):`, data.error || 'no subject')
    throw new AppError(502, 'Google sent back a profile we could not read. Please try again.')
  }
  // Without a verified email we cannot tell this person from a typo in someone
  // else's address, and accounts are keyed by email.
  if (data.email_verified === false) {
    throw new AppError(403, 'That Google account has no verified email address, so it cannot be used here.')
  }
  const email = String(data.email || '').trim().toLowerCase()
  if (!email) throw new AppError(403, 'That Google account does not share an email address, so it cannot be used here.')
  return { googleId: String(data.sub), email, name: displayName(data.name, email) }
}

/** Google names can be empty or one letter; the account schema needs two to eighty. */
export function displayName(name, email) {
  const clean = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 80)
  if (clean.length >= 2) return clean
  const local = email.split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '')
  return local.length >= 2 ? local.slice(0, 80) : 'Echo student'
}
