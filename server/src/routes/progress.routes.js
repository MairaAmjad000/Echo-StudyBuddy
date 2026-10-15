import { Router } from 'express'
import * as progress from '../controllers/progress.controller.js'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import {
  recordQuizSchema,
  recordCardsSchema,
  recordTeachSchema,
  toggleSectionSchema,
  touchSchema,
  settingsSchema,
} from '../validation/schemas.js'

const router = Router()

router.use(requireAuth)

router.get('/', asyncHandler(progress.get))
router.get('/summary', asyncHandler(progress.summary))
router.post('/quiz', validate(recordQuizSchema), asyncHandler(progress.recordQuiz))
router.post('/cards', validate(recordCardsSchema), asyncHandler(progress.recordCards))
router.post('/teach', validate(recordTeachSchema), asyncHandler(progress.recordTeach))
router.patch('/sections/:materialId', validate(toggleSectionSchema), asyncHandler(progress.toggleSection))
router.post('/last-studied', validate(touchSchema), asyncHandler(progress.touch))
router.patch('/settings', validate(settingsSchema), asyncHandler(progress.updateSettings))
router.post('/demo', asyncHandler(progress.loadDemo))
router.post('/reset', asyncHandler(progress.resetProgress))
router.delete('/', asyncHandler(progress.resetProgress))

export default router
