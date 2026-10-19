import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import * as whiteboard from '../controllers/whiteboard.controller.js'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { whiteboardSchema, whiteboardParamsSchema, whiteboardAudioSchema } from '../validation/schemas.js'

// Every lesson is an AI call (and a photo can carry a lot of pixels). The
// ceiling is generous for a study session and keeps one account from burning
// the shared free-tier quota.
const teachLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'That is a lot of lessons at once. Give Echo a few minutes.' },
})

// Recording a step is free but it is somebody else's service. A student walking
// a lesson asks for one step at a time, and the browser caches each MP3, so this
// ceiling is far above normal use and low enough not to be a free TTS API.
const voiceLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Echo has read out a lot in the last few minutes. Let the lesson rest, then try again.' },
})

const router = Router()

router.use(requireAuth)

router.get('/', asyncHandler(whiteboard.list))
router.get('/:id/audio/:index', voiceLimiter, validate(whiteboardAudioSchema), asyncHandler(whiteboard.audio))
router.get('/:id', validate(whiteboardParamsSchema), asyncHandler(whiteboard.show))
router.delete('/:id', validate(whiteboardParamsSchema), asyncHandler(whiteboard.remove))
router.post('/', teachLimiter, validate(whiteboardSchema), asyncHandler(whiteboard.create))

export default router
