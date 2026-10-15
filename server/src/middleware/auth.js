import { verifyToken } from '../lib/jwt.js'
import { User } from '../models/User.js'
import { unauthorized } from '../lib/AppError.js'

/** Reads the Bearer token or the httpOnly session cookie, verifies it and loads the user onto req.user. */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.cookies?.echo_session
  const payload = token ? verifyToken(token) : null
  if (!payload?.sub) return next(unauthorized('Your session expired. Please log in again.'))

  const user = await User.findById(payload.sub)
  if (!user) return next(unauthorized('Account no longer exists'))
  req.user = user
  next()
}
