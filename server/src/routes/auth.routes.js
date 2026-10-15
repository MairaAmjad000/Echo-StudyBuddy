import { Router } from 'express'
import { signup, login, logout, me, updateMe, deleteAccount } from '../controllers/auth.controller.js'
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

router.post('/signup', authLimiter, validate(signupSchema), asyncHandler(signup))
router.post('/login', authLimiter, validate(loginSchema), asyncHandler(login))
router.post('/logout', asyncHandler(logout))
router.get('/me', requireAuth, asyncHandler(me))
router.patch('/me', requireAuth, validate(updateMeSchema), asyncHandler(updateMe))
router.delete('/account', requireAuth, asyncHandler(deleteAccount))

export default router
