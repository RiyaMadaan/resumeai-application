import { Router } from 'express'
import {
  generate,
  edit,
  customize,
  atsScore,
  interview,
} from '../controllers/ai.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

// Every AI endpoint is protected — the userId comes from the verified JWT and
// each handler re-checks that the target resume belongs to that user.
router.use(requireAuth)

router.post('/generate', asyncHandler(generate))
router.post('/edit', asyncHandler(edit))
router.post('/customize', asyncHandler(customize))
router.post('/ats-score', asyncHandler(atsScore))
router.post('/interview', asyncHandler(interview))

export default router
