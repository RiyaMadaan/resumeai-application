import { Router } from 'express'
import {
  list,
  create,
  getOne,
  update,
  remove,
  generate,
  refine,
} from '../controllers/coverLetter.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

// All cover letter routes require authentication; each handler additionally
// re-checks that the letter (and any resume it reads) belongs to the caller.
router.use(requireAuth)

router.get('/', asyncHandler(list))
router.post('/', asyncHandler(create))

router.get('/:id', asyncHandler(getOne))
router.put('/:id', asyncHandler(update))
router.delete('/:id', asyncHandler(remove))

// AI actions, scoped to a letter the caller owns.
router.post('/:id/generate', asyncHandler(generate))
router.post('/:id/refine', asyncHandler(refine))

export default router
