import { Router } from 'express'
import * as materials from '../controllers/materials.controller.js'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { createMaterialSchema, linkSchema, completeMaterialSchema } from '../validation/schemas.js'

const router = Router()

router.use(requireAuth)

router.get('/', asyncHandler(materials.list))
router.post('/', validate(createMaterialSchema), asyncHandler(materials.create))
router.post('/link', validate(linkSchema), asyncHandler(materials.link))
router.get('/:id', asyncHandler(materials.show))
router.patch('/:id', validate(completeMaterialSchema), asyncHandler(materials.complete))
router.delete('/:id', asyncHandler(materials.remove))

export default router
