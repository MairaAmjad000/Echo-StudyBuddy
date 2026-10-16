import { Router } from 'express'
import {
  signup,
  login,
  logout,
  me,
  updateMe,
  deleteAccount,
  providers,
  googleStart,
  googleCallback,
} from '../controllers/auth.controller.js'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { signupSchema, loginSchema, updateMeSchema } from '../validation/schemas.js'
import { rateLimit } from 'express-rate-limit'

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Wait a few minutes and try again.' },
})

const router = Router()

// The two Google routes are navigations, not fetches: a rate-limited 429 here
// would land as a bare JSON page in the middle of a sign-in. The callback is
// already gated by the signed state cookie and by Google's own one-time code.
router.get('/providers', asyncHandler(providers))
router.get('/google', asyncHandler(googleStart))
router.get('/google/callback', asyncHandler(googleCallback))

router.post('/signup', authLimiter, validate(signupSchema), asyncHandler(signup))
router.post('/login', authLimiter, validate(loginSchema), asyncHandler(login))
router.post('/logout', asyncHandler(logout))
router.get('/me', requireAuth, asyncHandler(me))
router.patch('/me', requireAuth, validate(updateMeSchema), asyncHandler(updateMe))
router.delete('/account', requireAuth, asyncHandler(deleteAccount))

export default router
