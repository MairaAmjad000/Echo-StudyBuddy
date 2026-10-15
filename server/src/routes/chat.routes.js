import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import * as chat from '../controllers/chat.controller.js'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { chatSchema, chatSessionParamsSchema } from '../validation/schemas.js'

// Every message costs an AI call, so keep one account from burning the quota.
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Echo needs a short break. Ask again in a minute.' },
})

const router = Router()

router.use(requireAuth)

// History is read and deleted freely; only asking costs an AI call.
router.get('/sessions', asyncHandler(chat.listSessions))
router.get('/sessions/:id', validate(chatSessionParamsSchema), asyncHandler(chat.getSession))
router.delete('/sessions/:id', validate(chatSessionParamsSchema), asyncHandler(chat.removeSession))

router.post('/', chatLimiter, validate(chatSchema), asyncHandler(chat.ask))

export default router
