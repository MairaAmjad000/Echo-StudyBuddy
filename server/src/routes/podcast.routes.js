import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import * as podcast from '../controllers/podcast.controller.js'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { createPodcastSchema, podcastParamsSchema, podcastAudioSchema, podcastPositionSchema } from '../validation/schemas.js'

// Writing an episode costs an AI call, so it is the one to keep a lid on.
const writeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'That is a lot of episodes at once. Give Echo a few minutes.' },
})

// Recording is free but it is somebody else's service, and a player working
// through a long episode asks for one turn at a time. The ceiling sits well
// above what one listener needs and low enough that the endpoint is not a
// general-purpose text-to-speech API for the internet.
const voiceLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 400,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Echo has read out a lot in the last few minutes. Let the episode finish, then try again.' },
})

const router = Router()

router.use(requireAuth)

router.get('/', asyncHandler(podcast.list))
router.post('/', writeLimiter, validate(createPodcastSchema), asyncHandler(podcast.create))
router.get('/:id', validate(podcastParamsSchema), asyncHandler(podcast.show))
router.get('/:id/audio/:index', voiceLimiter, validate(podcastAudioSchema), asyncHandler(podcast.audio))
router.patch('/:id', validate(podcastPositionSchema), asyncHandler(podcast.savePosition))
router.delete('/:id', validate(podcastParamsSchema), asyncHandler(podcast.remove))

export default router
