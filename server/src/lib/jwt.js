import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'

export const signToken = (userId) => jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES })

/** Returns the payload { sub } or null when the token is invalid/expired. */
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, env.JWT_SECRET)
  } catch {
    return null
  }
}
